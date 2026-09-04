"""
SPH runner with two modes:
  - "external": stage inputs, leave a MANIFEST.json, mark job awaiting_external_gpu.
  - "local":    run GenCase + DualSPHysics5.2CUDA via subprocess.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from ...core.config import settings


def stage_external_inputs(
    job_dir: Path,
    stl_source: Path,
    hydrograph_csv_source: Path,
    case_xml_source: Path,
    request_payload: dict[str, Any],
) -> Path:
    """
    Copy every input DualSPHysics needs into <job_dir>/sph/inputs/ and drop a
    MANIFEST.json describing what to run. This folder is exactly what the GPU
    laptop's helper script consumes.
    """
    inputs = job_dir / "sph" / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)

    for src in (stl_source, hydrograph_csv_source, case_xml_source):
        (inputs / src.name).write_bytes(Path(src).read_bytes())

    manifest = {
        "job_id": job_dir.name,
        "case_xml": case_xml_source.name,
        "stl": stl_source.name,
        "hydrograph_csv": hydrograph_csv_source.name,
        "request": request_payload,
        "instructions": [
            "1. GenCase.exe Case_def -save:all",
            "2. DualSPHysics5.2CUDA.exe Case -dirdataout out -svres -cpu",
            "   (or the CUDA equivalent for your GPU)",
            "3. PartVTK.exe -dirin out -filexml Case.xml -savevtk fluid",
            "4. zip the entire 'out' folder + Case.xml as sph_outputs.zip",
            "5. Upload:  POST /simulations/<job_id>/sph-results",
        ],
    }
    (inputs / "MANIFEST.json").write_text(json.dumps(manifest, indent=2))
    return inputs


def run_local(job_dir: Path, case_xml: Path) -> Path:
    """
    Invoke GenCase + DualSPHysics locally. Requires settings.dualsphysics_bin_dir.
    Only used on machines with an NVIDIA GPU + CUDA.
    """
    if not settings.dualsphysics_bin_dir:
        raise RuntimeError("dualsphysics_bin_dir not configured")

    bin_dir = Path(settings.dualsphysics_bin_dir)
    out_dir = job_dir / "sph" / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)

    gencase = bin_dir / "GenCase"
    dsph = bin_dir / "DualSPHysics5.2CUDA"

    subprocess.run(
        [str(gencase), str(case_xml.with_suffix("")), "-save:all"],
        check=True, cwd=case_xml.parent,
    )
    subprocess.run(
        [str(dsph), str(case_xml.with_suffix("")),
         "-dirdataout", str(out_dir), "-svres"],
        check=True, cwd=case_xml.parent,
    )
    return out_dir
