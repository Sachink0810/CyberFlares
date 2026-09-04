"""
Companion CLI for the GPU laptop.

Usage:
    python run_sph_on_gpu.py path/to/inputs_dir \
        --dsph-bin "C:/DualSPHysics5.2/bin/windows" \
        --backend  "http://<dev-laptop-ip>:8000"

Consumes an inputs folder produced by `stage_external_inputs`, runs GenCase
+ DualSPHysics + PartVTK, zips the outputs, and POSTs them back to the
backend as /simulations/<job_id>/sph-results.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path


def _run(cmd: list[str], cwd: Path):
    print(">>", " ".join(cmd))
    subprocess.run(cmd, cwd=cwd, check=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("inputs_dir", type=Path,
                   help="Folder containing MANIFEST.json, .xml, .stl, .csv")
    p.add_argument("--dsph-bin", required=True, type=Path,
                   help="DualSPHysics 'bin/windows' or 'bin/linux' directory")
    p.add_argument("--backend", required=True,
                   help="Backend base URL, e.g. http://192.168.1.10:8000")
    p.add_argument("--skip-upload", action="store_true")
    args = p.parse_args()

    inputs_dir: Path = args.inputs_dir.resolve()
    manifest = json.loads((inputs_dir / "MANIFEST.json").read_text())
    job_id = manifest["job_id"]
    case_xml = inputs_dir / manifest["case_xml"]
    case_stem = case_xml.with_suffix("")

    out_dir = inputs_dir.parent / "outputs"
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    bin_dir: Path = args.dsph_bin
    ext = ".exe" if sys.platform.startswith("win") else ""
    gencase = bin_dir / f"GenCase{ext}"
    dsph    = bin_dir / f"DualSPHysics5.2CUDA{ext}"
    partvtk = bin_dir / f"PartVTK{ext}"

    for exe in (gencase, dsph, partvtk):
        if not exe.exists():
            sys.exit(f"missing DualSPHysics binary: {exe}")

    _run([str(gencase), str(case_stem), "-save:all"], cwd=inputs_dir)
    _run([str(dsph), str(case_stem),
          "-dirdataout", str(out_dir), "-svres"], cwd=inputs_dir)
    _run([str(partvtk), "-dirin", str(out_dir),
          "-filexml", str(case_stem) + ".xml",
          "-savevtk", str(out_dir / "fluid")], cwd=inputs_dir)

    zip_path = inputs_dir.parent / "sph_outputs.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in out_dir.rglob("*"):
            if f.is_file():
                z.write(f, f.relative_to(out_dir))
    print(f"packaged: {zip_path}  ({zip_path.stat().st_size/1e6:.1f} MB)")

    if args.skip_upload:
        return

    import requests
    url = f"{args.backend.rstrip('/')}/simulations/{job_id}/sph-results"
    with zip_path.open("rb") as fh:
        r = requests.post(url, files={"archive": (zip_path.name, fh, "application/zip")})
    print(r.status_code, r.text[:400])
    r.raise_for_status()


if __name__ == "__main__":
    main()
