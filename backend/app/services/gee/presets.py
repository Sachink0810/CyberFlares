"""
Curated historic Indian flood events, used both for pre-caching SAR results
(via ``scripts/precache_sar_presets.py``) and for the frontend's preset
chip HUD (via ``GET /api/nrt/sar/presets``).
"""
from dataclasses import dataclass
from typing import Any


@dataclass
class SARPreset:
    key: str
    event_name: str
    center_lat: float
    center_lon: float
    radius_km: float
    start_date: str
    end_date: str
    note: str
    change_detection: bool = True
    pass_direction: str = "AUTO"

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "event_name": self.event_name,
            "center_lat": self.center_lat,
            "center_lon": self.center_lon,
            "radius_km": self.radius_km,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "note": self.note,
            "change_detection": self.change_detection,
            "pass_direction": self.pass_direction,
        }


SAR_PRESETS: list[SARPreset] = [
    SARPreset(
        key="godavari-2022",
        event_name="Godavari_Forest_Flood",
        center_lat=17.35, center_lon=81.55, radius_km=25,
        start_date="2022-07-13", end_date="2022-07-25",
        note="Andhra Pradesh forest catchment · Jul 2022",
    ),
    SARPreset(
        key="kerala-2018",
        event_name="Kerala_Mixed_Flood",
        center_lat=10.10, center_lon=76.35, radius_km=15,
        start_date="2018-08-15", end_date="2018-08-25",
        note="Kerala floods · Aug 2018",
    ),
    SARPreset(
        key="tiware-2019",
        event_name="Tiware",
        center_lat=17.5, center_lon=73.5, radius_km=50,
        start_date="2019-07-02", end_date="2019-08-15",
        note="Tiware dam breach · Maharashtra · Jul 2019",
    ),
]


def get_preset(key: str) -> SARPreset | None:
    return next((p for p in SAR_PRESETS if p.key == key), None)
