import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Map as MLMap, Marker, Popup, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Mountain, Radar, MapPin, Play, Pause, RotateCcw } from "lucide-react";

import { listDams, breachPreview } from "../api/client";
import { useDam } from "../store/damStore";
import { useTimeline } from "../store/timelineStore";
import { useSar } from "../store/sarStore";
import type { DamInfo, DamParameters } from "../types";

type LayerMode = "terrain" | "domain" | "flood";

// ── Geographic-circle GeoJSON (radius km) ───────────────────────
function circleGeoJSON(lon: number, lat: number, radiusKm: number, n = 96) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const coords: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    coords.push([
      lon + (radiusKm * Math.cos(a)) / (111.32 * cosLat),
      lat + (radiusKm * Math.sin(a)) / 111.32,
    ]);
  }
  return {
    type: "FeatureCollection" as const,
    features: [{
      type: "Feature" as const, properties: {},
      geometry: { type: "Polygon" as const, coordinates: [coords] },
    }],
  };
}

// ── Diamond / dot markers ───────────────────────────────────────
function markerEl(kind: "selected" | "dot") {
  const el = document.createElement("div");
  el.className = "cf-dam-marker";
  if (kind === "selected") {
    el.style.cssText = `
      width: 26px; height: 26px; cursor: pointer;
      filter: drop-shadow(0 0 10px rgba(200,120,95,.55));
      transition: transform .18s cubic-bezier(.16,1,.3,1);
    `;
    el.innerHTML = `
      <svg viewBox="0 0 24 24" width="26" height="26">
        <path d="M12 2 L22 12 L12 22 L2 12 Z"
              fill="#C8785F" stroke="#F1F0EA" stroke-width="1.5"
              stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="2.6" fill="#0D1112"/>
      </svg>`;
  } else {
    el.style.cssText = `
      width: 8px; height: 8px; border-radius: 50%;
      background: #6E9DA5; opacity: 0.75;
      border: 1px solid rgba(241,240,234,.6);
      cursor: pointer;
      transition: transform .15s, opacity .15s;
    `;
    el.onmouseenter = () => { el.style.transform = "scale(1.6)"; el.style.opacity = "1"; };
    el.onmouseleave = () => { el.style.transform = "scale(1)"; el.style.opacity = "0.75"; };
  }
  return el;
}

// ── Compact hydrograph fmt ──────────────────────────────────────
const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(2)}k`
  : n.toFixed(0);


export default function DamMap() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>("machchhu-ii");
  const [layerMode, setLayerMode] = useState<LayerMode>("terrain");
  const flownRef = useRef(false);

  const setK = useDam((s) => s.set);
  const dam = useDam((s) => s.dam);
  const sarGeoJSON = useSar((s) => s.geojson);
  const hasFlood = !!sarGeoJSON && sarGeoJSON.features?.length > 0;

  const { data: dams, isLoading } = useQuery({
    queryKey: ["dams"],
    queryFn: listDams,
    staleTime: 5 * 60_000,
  });

  // Grab the hydrograph so we can drive the timeline strip.
  const { data: hydro } = useQuery({
    queryKey: ["breach", dam],
    queryFn: () => breachPreview(dam),
    refetchOnWindowFocus: false,
  });

  const tMax = hydro?.breach_time_hours ?? 2;
  const { t, playing, setT, setTMax, togglePlay, stop } = useTimeline();
  useEffect(() => { setTMax(tMax); }, [tMax, setTMax]);

  // Play loop
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      const nt = useTimeline.getState().t + dt * 0.6;   // 0.6 hours / s
      if (nt >= tMax) { setT(tMax); useTimeline.setState({ playing: false }); return; }
      setT(nt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, tMax, setT]);

  // ── Current Q(t) for the timeline HUD ──
  const currentQ = useMemo(() => {
    if (!hydro?.hydrograph?.length) return 0;
    const h = hydro.hydrograph;
    if (t <= h[0].t_hours) return h[0].discharge_m3s;
    if (t >= h[h.length - 1].t_hours) return h[h.length - 1].discharge_m3s;
    for (let i = 1; i < h.length; i++) {
      if (h[i].t_hours >= t) {
        const a = h[i - 1], b = h[i];
        const w = (t - a.t_hours) / (b.t_hours - a.t_hours);
        return a.discharge_m3s + w * (b.discharge_m3s - a.discharge_m3s);
      }
    }
    return 0;
  }, [t, hydro]);

  // ─────────────────────────────────────────────────────────────
  // Boot map
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    // ── Tile-source strategy ───────────────────────────────────────
    //   • With a MapTiler key → their "hybrid" style (satellite + labels).
    //   • Without → hand-built style: Esri satellite (moody-tuned) as base
    //     for every zoom level, hillshade for relief, subtle OpenFreeMap
    //     vector labels drawn on top so places stay legible even at z 3.
    const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

    const style = MAPTILER_KEY
      ? `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
      : {
          version: 8 as const,
          glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
          sources: {
            esri: {
              type: "raster" as const,
              tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
              tileSize: 256, maxzoom: 19,
              attribution: "Tiles © Esri, Maxar, Earthstar",
            },
            labels: {
              type: "vector" as const,
              url: "https://tiles.openfreemap.org/planet",
            },
          },
          layers: [
            { id: "abyss", type: "background" as const,
              paint: { "background-color": "#070A0B" } },
            { id: "satellite", type: "raster" as const, source: "esri",
              paint: {
                "raster-brightness-min": 0.04,
                "raster-brightness-max": 0.75,
                "raster-saturation": -0.25,
                "raster-contrast": 0.20,
                "raster-hue-rotate": 195,
                "raster-opacity": 0.98,
              } },
            // Place labels — capitals, cities, states
            { id: "place-country", type: "symbol" as const,
              source: "labels", "source-layer": "place",
              filter: ["==", "class", "country"],
              layout: {
                "text-field": ["get", "name:en"],
                "text-font": ["Noto Sans Regular"],
                "text-size": 12,
                "text-letter-spacing": 0.24,
                "text-transform": "uppercase",
              },
              paint: {
                "text-color": "#C8CFCE",
                "text-halo-color": "#050809",
                "text-halo-width": 1.6,
              } },
            { id: "place-state", type: "symbol" as const,
              source: "labels", "source-layer": "place",
              filter: ["==", "class", "state"],
              minzoom: 4,
              layout: {
                "text-field": ["get", "name:en"],
                "text-font": ["Noto Sans Regular"],
                "text-size": 10.5,
                "text-letter-spacing": 0.20,
                "text-transform": "uppercase",
              },
              paint: {
                "text-color": "#9EA4A3",
                "text-halo-color": "#050809",
                "text-halo-width": 1.4,
              } },
            { id: "place-city", type: "symbol" as const,
              source: "labels", "source-layer": "place",
              filter: ["in", "class", "city", "town"],
              minzoom: 6,
              layout: {
                "text-field": ["get", "name:en"],
                "text-font": ["Noto Sans Regular"],
                "text-size": 11,
              },
              paint: {
                "text-color": "#DFE3E2",
                "text-halo-color": "#050809",
                "text-halo-width": 1.4,
              } },
          ],
        };

    const m = new MLMap({
      container: mapEl.current,
      style: style as any,
      center: [79.5, 22.5],
      zoom: 4.2, minZoom: 3, maxZoom: 17,
      maxPitch: 65, pitch: 0, bearing: 0,
      attributionControl: { compact: true },
    });
    m.addControl(new NavigationControl({ visualizePitch: true, showCompass: true }), "top-right");

    m.on("style.load", () => {
      // (The old Liberty-style recolour pass is no longer needed — the
      // default style is now a satellite raster tuned in-place via raster
      // paint properties.)

      // Elevation source (terrarium encoding, AWS public bucket)
      if (!m.getSource("dem")) {
        m.addSource("dem", {
          type: "raster-dem",
          tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
          tileSize: 256, encoding: "terrarium", maxzoom: 15,
        });
        m.setTerrain({ source: "dem", exaggeration: 1.4 });
      }

      // Hillshade — the terrain-relief layer that makes mountains visible.
      // Inserted just under the first symbol layer so text labels stay on top.
      if (!m.getLayer("hillshade")) {
        const firstSymbol = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
        m.addLayer({
          id: "hillshade", type: "hillshade", source: "dem",
          paint: {
            "hillshade-shadow-color": "#050809",
            "hillshade-highlight-color": "#8FB4BC",
            "hillshade-accent-color": "#C8785F",
            "hillshade-exaggeration": 0.85,
            "hillshade-illumination-direction": 315,
          },
        }, firstSymbol);
      }

      // Solver-domain circles (near + far)
      const ensureCircle = (id: string, colour: string, opacity: number, dash: number[]) => {
        if (!m.getSource(id)) {
          m.addSource(id, { type: "geojson",
            data: { type: "FeatureCollection", features: [] } });
          m.addLayer({ id: `${id}-fill`, type: "fill", source: id,
            paint: { "fill-color": colour, "fill-opacity": opacity } });
          m.addLayer({ id: `${id}-line`, type: "line", source: id,
            paint: { "line-color": colour, "line-width": 1.4, "line-dasharray": dash } });
        }
      };
      ensureCircle("far-domain",  "#6E9DA5", 0.06, [4, 3]);
      ensureCircle("near-domain", "#C8785F", 0.10, [3, 2]);

      // ── SAR flood layer (populated by NRTPanel via useSar) ──
      if (!m.getSource("sar-flood")) {
        m.addSource("sar-flood", { type: "geojson",
          data: { type: "FeatureCollection", features: [] } });
        m.addLayer({
          id: "sar-flood-fill", type: "fill", source: "sar-flood",
          layout: { visibility: "none" },
          paint: {
            "fill-color": "#C8785F",
            "fill-opacity": 0.42,
            "fill-outline-color": "#F1F0EA",
          },
        });
        m.addLayer({
          id: "sar-flood-line", type: "line", source: "sar-flood",
          layout: { visibility: "none" },
          paint: {
            "line-color": "#F1F0EA",
            "line-width": 0.6,
            "line-opacity": 0.55,
          },
        });
      }
    });

    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Push SAR geojson into the flood layer + toggle its visibility
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const push = () => {
      const src = m.getSource("sar-flood") as any;
      if (src) src.setData(sarGeoJSON ?? { type: "FeatureCollection", features: [] });
      const visible = layerMode === "flood" && hasFlood ? "visible" : "none";
      if (m.getLayer("sar-flood-fill"))
        m.setLayoutProperty("sar-flood-fill", "visibility", visible);
      if (m.getLayer("sar-flood-line"))
        m.setLayoutProperty("sar-flood-line", "visibility", visible);
    };
    if (m.isStyleLoaded()) push(); else m.once("style.load", push);
  }, [sarGeoJSON, hasFlood, layerMode]);

  // Flip to Flood layer the moment new SAR data arrives
  useEffect(() => { if (hasFlood) setLayerMode("flood"); }, [hasFlood]);

  // ─────────────────────────────────────────────────────────────
  // Render dam markers (small dots + one prominent selected diamond)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !dams) return;

    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    dams.forEach((d) => {
      const isSel = d.id === selectedId;
      const el = markerEl(isSel ? "selected" : "dot");

      const popup = new Popup({ offset: isSel ? 18 : 12,
                                closeButton: false, closeOnClick: true })
        .setHTML(`
          <div style="font-family:Inter,system-ui;background:#0D1112;color:#F1F0EA;
                      padding:10px 12px;border-radius:8px;border:1px solid #ffffff18;
                      min-width:200px;">
            <div style="font-family:'Instrument Serif',Georgia,serif;font-size:16px;line-height:1.1;">
              ${d.name}
            </div>
            <div style="font-size:10px;color:#9EA4A3;margin-top:4px;
                        letter-spacing:.14em;text-transform:uppercase;">
              ${d.river} · ${d.state}
            </div>
            <div style="font-size:11px;margin-top:8px;line-height:1.6;">
              H<sub>w</sub>: <b>${d.H_w} m</b> · V<sub>w</sub>: <b>${d.V_w_mcm} Mm³</b>
            </div>
          </div>
        `);

      el.onclick = (e) => { e.stopPropagation(); selectDam(d); };

      const mk = new Marker({ element: el, anchor: "center" })
        .setLngLat([d.dam_lon, d.dam_lat])
        .setPopup(popup)
        .addTo(m);
      markersRef.current.push(mk);
    });
  }, [dams, selectedId]);

  // ─────────────────────────────────────────────────────────────
  // Auto-fly to default dam once the map + dam list are ready
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !dams || flownRef.current) return;
    const target = dams.find((d) => d.id === selectedId) ?? dams[0];
    if (!target) return;

    const fly = () => {
      pushDomainCircles(target);
      m.flyTo({
        center: [target.dam_lon, target.dam_lat],
        zoom: 9.5, pitch: 50, bearing: -20,
        speed: 0.9, curve: 1.6,
      });
      flownRef.current = true;
    };
    if (m.isStyleLoaded()) fly(); else m.once("style.load", fly);
  }, [dams, selectedId]);

  function pushDomainCircles(d: DamInfo) {
    const m = mapRef.current;
    if (!m) return;
    (m.getSource("near-domain") as any)?.setData(circleGeoJSON(d.dam_lon, d.dam_lat, 5));
    (m.getSource("far-domain")  as any)?.setData(circleGeoJSON(d.dam_lon, d.dam_lat, 50));
  }

  function selectDam(d: DamInfo) {
    setSelectedId(d.id);
    stop();
    (["name","dam_lat","dam_lon","H_w","V_w_mcm","delta"] as (keyof DamParameters)[])
      .forEach((k) => setK(k, (d as any)[k]));
    const m = mapRef.current;
    if (!m) return;
    const push = () => {
      pushDomainCircles(d);
      m.flyTo({ center: [d.dam_lon, d.dam_lat],
                zoom: 10.5, pitch: 55, bearing: -22, speed: 1.1, curve: 1.6 });
    };
    if (m.isStyleLoaded()) push(); else m.once("style.load", push);
  }

  const resetView = () => {
    mapRef.current?.flyTo({
      center: [79.5, 22.5], zoom: 4.2, pitch: 0, bearing: 0, speed: 1.4,
    });
  };

  const selectedDam = dams?.find((d) => d.id === selectedId);
  const progressPct = Math.min(100, (t / tMax) * 100);

  return (
    <div className="card flex-1 min-h-[420px] flex flex-col p-0 overflow-hidden relative">
      {/* ── Top-left · scenario card ── */}
      <div className="absolute z-10 top-3 left-3 max-w-[300px] pointer-events-auto">
        <div className="bg-abyss/85 backdrop-blur border border-white/[.06]
                        rounded-lg px-4 py-3.5">
          <div className="eyebrow mb-1.5">Active scenario</div>
          <div className="fs-serif text-2xl text-cream leading-none">
            {dam.name}
          </div>
          {selectedDam && (
            <div className="mt-2 text-[10px] text-mist uppercase tracking-[.16em]">
              {selectedDam.river} · {selectedDam.state}
            </div>
          )}
          <div className="mt-2 text-[11px] text-mist flex items-center gap-1.5 tabular-nums">
            <MapPin size={11} className="text-ember" />
            {dam.dam_lat.toFixed(3)}° N · {dam.dam_lon.toFixed(3)}° E
          </div>
          {selectedDam?.note && (
            <div className="mt-2 pt-2 border-t border-white/[.06] text-[10px] text-steel leading-relaxed">
              {selectedDam.note}
            </div>
          )}
        </div>
      </div>

      {/* ── Top-right · sim state pill (offset from nav control) ── */}
      <div className="absolute z-10 top-3 right-14 pointer-events-auto">
        <div className="bg-abyss/85 backdrop-blur border border-white/[.06]
                        rounded-lg px-3.5 py-2.5 min-w-[190px]">
          <div className="flex items-center justify-between mb-2">
            <div className="eyebrow">Sim state</div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-water animate-pulse" />
              <span className="text-[10px] uppercase tracking-[.16em] text-water">Ready</span>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[10.5px]">
            <span className="text-mist">Near · SPH</span>
            <span className="fs-serif text-cream">5 km</span>
            <span className="text-mist">Far · Delft3D</span>
            <span className="fs-serif text-cream">50 km</span>
            <span className="text-mist">DEM</span>
            <span className="fs-serif text-cream">FABDEM 30 m</span>
          </div>
        </div>
      </div>

      {/* ── Bottom timeline strip ── */}
      <div className="absolute z-10 bottom-3 left-3 right-3 pointer-events-auto">
        <div className="bg-abyss/85 backdrop-blur border border-white/[.06]
                        rounded-lg px-4 py-3 flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-ember hover:bg-ember/85 text-abyss
                       grid place-items-center transition-colors shrink-0"
          >
            {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
          </button>
          <button
            onClick={() => stop()}
            className="text-mist hover:text-cream shrink-0"
            title="Reset time"
          >
            <RotateCcw size={13} />
          </button>

          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[.16em] text-mist">
              <span>Breach propagation · T+{(t * 60).toFixed(0).padStart(2, "0")} min</span>
              <span className="normal-case tracking-normal text-cream fs-serif text-sm">
                Q(t) = {fmt(currentQ)} m³/s
              </span>
            </div>
            {/* Scrub track */}
            <div
              className="relative h-1 rounded-full bg-white/[.06] cursor-pointer"
              onMouseDown={(e) => {
                const track = e.currentTarget;
                const seek = (clientX: number) => {
                  const r = track.getBoundingClientRect();
                  const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
                  setT(p * tMax);
                };
                seek(e.clientX);
                const move = (ev: MouseEvent) => seek(ev.clientX);
                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
            >
              <div className="absolute inset-y-0 left-0 rounded-full bg-ember/80"
                   style={{ width: `${progressPct}%` }} />
              <div className="absolute -top-1 w-3 h-3 rounded-full bg-cream border-2 border-ember"
                   style={{ left: `calc(${progressPct}% - 6px)` }} />
            </div>
            <div className="flex justify-between text-[9.5px] text-steel tabular-nums">
              <span>T+00</span>
              <span>T+{(tMax * 15).toFixed(0)} min</span>
              <span>T+{(tMax * 30).toFixed(0)} min</span>
              <span>T+{(tMax * 45).toFixed(0)} min</span>
              <span>T+{(tMax * 60).toFixed(0)} min · t_f</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Layer toggle (above timeline) ── */}
      <div className="absolute z-10 bottom-[90px] left-3 pointer-events-auto">
        <div className="bg-abyss/85 backdrop-blur border border-white/[.06]
                        rounded-lg p-1 flex gap-1">
          <LayerBtn active={layerMode === "terrain"} onClick={() => setLayerMode("terrain")}>
            <Mountain size={12} /> Terrain
          </LayerBtn>
          <LayerBtn active={layerMode === "domain"} onClick={() => setLayerMode("domain")}>
            <Radar size={12} /> Domain
          </LayerBtn>
          <button
            onClick={() => hasFlood && setLayerMode("flood")}
            disabled={!hasFlood}
            title={hasFlood ? "Show SAR flood polygons" : "Run an NRT SAR analysis first"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px]
                        uppercase tracking-[.14em] transition
                        ${layerMode === "flood" && hasFlood
                          ? "bg-water/20 text-cream border border-water/40"
                          : hasFlood
                          ? "text-mist hover:text-cream"
                          : "text-steel/60 opacity-40 cursor-not-allowed"}`}
          >
            <Layers size={12} /> Flood
          </button>
        </div>
      </div>

      {/* ── Bottom-right · reset view ── */}
      <div className="absolute z-10 bottom-[90px] right-3 pointer-events-auto">
        <button
          onClick={resetView}
          className="bg-abyss/85 backdrop-blur border border-white/[.06]
                     rounded-md px-3 py-1.5 text-[11px] uppercase tracking-[.14em]
                     text-mist hover:text-cream"
        >
          Reset view
        </button>
      </div>

      {/* Small unobtrusive dam count */}
      <div className="absolute z-10 top-3 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="text-[9.5px] text-steel uppercase tracking-[.20em]
                        bg-abyss/60 backdrop-blur border border-white/[.05]
                        rounded-full px-3 py-1">
          {isLoading ? "loading…" : `${dams?.length ?? 0} dams in registry`}
        </div>
      </div>

      <div ref={mapEl} className="flex-1 w-full h-full" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Re-tint a colourful vector style (OpenFreeMap Liberty) to the
// FLOOD//SIM dark palette. Runs once at style.load. Values chosen
// to match the landing page: abyss land, muted teal water,
// steel-grey roads, cream labels.
// ─────────────────────────────────────────────────────────────
function recolourToDarkPalette(m: MLMap) {
  const LAND       = "#0B1113";
  const LAND_ALT   = "#0F1719";
  const WATER      = "#123138";
  const WATER_LINE = "#1E4A55";
  const ROAD_MINOR = "#1B2427";
  const ROAD_MAJOR = "#2A363A";
  const BUILDING   = "#141A1D";
  const BOUNDARY   = "#2E3A3E";
  const LABEL      = "#B7BEBE";
  const LABEL_HALO = "#050809";

  const layers = m.getStyle().layers;

  for (const l of layers) {
    const id = l.id.toLowerCase();
    try {
      // Backgrounds & land
      if (l.type === "background") {
        m.setPaintProperty(l.id, "background-color", LAND);
      }
      if (l.type === "fill") {
        if (id.includes("water") || id.includes("river") || id.includes("lake") || id.includes("ocean")) {
          m.setPaintProperty(l.id, "fill-color", WATER);
          m.setPaintProperty(l.id, "fill-opacity", 0.9);
        } else if (id.includes("building")) {
          m.setPaintProperty(l.id, "fill-color", BUILDING);
          m.setPaintProperty(l.id, "fill-opacity", 0.7);
        } else if (id.includes("park") || id.includes("wood") || id.includes("forest") ||
                   id.includes("landuse") || id.includes("landcover") ||
                   id.includes("grass") || id.includes("scrub") || id.includes("residential")) {
          m.setPaintProperty(l.id, "fill-color", LAND_ALT);
          m.setPaintProperty(l.id, "fill-opacity", 0.55);
        } else {
          m.setPaintProperty(l.id, "fill-color", LAND);
        }
      }
      if (l.type === "line") {
        if (id.includes("water") || id.includes("river") || id.includes("waterway")) {
          m.setPaintProperty(l.id, "line-color", WATER_LINE);
          m.setPaintProperty(l.id, "line-opacity", 0.6);
        } else if (id.includes("boundary") || id.includes("border") || id.includes("admin")) {
          m.setPaintProperty(l.id, "line-color", BOUNDARY);
          m.setPaintProperty(l.id, "line-opacity", 0.45);
        } else if (id.includes("motorway") || id.includes("trunk") || id.includes("primary")) {
          m.setPaintProperty(l.id, "line-color", ROAD_MAJOR);
          m.setPaintProperty(l.id, "line-opacity", 0.55);
        } else if (id.includes("road") || id.includes("street") || id.includes("path") || id.includes("rail")) {
          m.setPaintProperty(l.id, "line-color", ROAD_MINOR);
          m.setPaintProperty(l.id, "line-opacity", 0.4);
        }
      }
      if (l.type === "symbol") {
        m.setPaintProperty(l.id, "text-color", LABEL);
        m.setPaintProperty(l.id, "text-halo-color", LABEL_HALO);
        m.setPaintProperty(l.id, "text-halo-width", 1.2);
        // Hide icons that would clash (POI dots, etc)
        if (id.includes("poi") || id.includes("aerodrome")) {
          m.setLayoutProperty(l.id, "visibility", "none");
        }
      }
    } catch { /* some layers don't accept certain paint props — skip */ }
  }
}

function LayerBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px]
                  uppercase tracking-[.14em] transition
                  ${active ? "bg-white/[.08] text-cream" : "text-mist hover:text-cream"}`}
    >
      {children}
    </button>
  );
}
