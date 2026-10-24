# Sanubari — Migration Package: rPPG Engine (Phase 9.1 Freeze)

Paket ini berisi **10 modul inti engine rPPG** dalam keadaan **identik byte-per-byte**
dengan sumbernya di `D:\main\Projects\Health` (branch `main`, HEAD `1bf1c3b`).
Tidak ada satu pun baris kode, parameter konfigurasi, atau nilai algoritma yang diubah.

> **Status validasi:** paket **belum divalidasi lewat tes atau benchmark**.
> Pengujian tidak dijalankan (sesuai instruksi). Yang sudah dilakukan hanya pemeriksaan
> statis: inventaris import langsung + transitif, salinan verbatim, dan perbandingan biner.

---

## 1. Isi paket

| File | Ukuran | Peran |
|---|---|---|
| `rppg_core.py` | 128.1 KB | Engine utama: ROI, deteksi gerak, fusion, BPM/SQI |
| `rppg_config.py` | 7.2 KB | `RPPGConfig` → objek global `cfg` (127 field) |
| `rppg_algorithms.py` | 1.7 KB | Ekstraksi kanal warna (POS / CHROM / green / ICA) |
| `rppg_temporal.py` | 5.5 KB | Filter Kalman BPM, tracker Bayesian, fusion probabilistik |
| `rppg_sqi.py` | 15.7 KB | SQI: posterior, statistik, pembobotan Bayesian ROI |
| `rppg_signal.py` | 15.1 KB | Windowing, harmonik, interferensi respirasi, optical flow, pulse-rich pixel |
| `rppg_physio_state.py` | 8.4 KB | Klasifikasi state fisiologis, adapter RR Whitaker |
| `rppg_uncertainty.py` | 8.2 KB | Estimator HR Bayesian, uncertainty-aware confidence |
| `rppg_roi.py` | 1.7 KB | `AdaptiveROIManager` |
| `rppg_benchmark.py` | 26.9 KB | **Hanya** `ReproducibilityProtocol` yang dipakai engine |
| `requirements.txt` | — | Dependency runtime (lihat §3) |
| `README_MIGRATION.md` | — | Dokumen ini |

**Struktur flat.** Modul-modul ini mengimpor satu sama lain dengan nama absolut tingkat-atas
(`from rppg_config import cfg`), bukan `from .rppg_config import cfg`. Konsekuensinya:

- cara paling sederhana: letakkan 10 file `.py` ini di root import target (root repo Sanubari);
- atau simpan di folder (mis. `sanubari/rppg/`) dan tambahkan folder itu ke `sys.path` /
  set `PYTHONPATH` / jadikan root repo sebagai `pythonpath` di `pytest.ini`.

### Yang tidak disertakan (dan alasannya)

| Tidak disertakan | Alasan |
|---|---|
| `rppg_main.py` | Aplikasi kamera live + MediaPipe + GUI. Bukan bagian engine; memaksa dependensi `mediapipe`. |
| `rppg_vitals.py` | Lapisan HRV/respiro (+`rppg_vitals` tidak diimpor engine mana pun). |
| `rppg_ai.py` | Lapisan interpretasi AI + `rppg_sessions.db` + panggil API Anthropic. |
| `models/*.task`, `models/*.tflite` | Model MediaPipe; hanya dibutuhkan alur live/benchmark, bukan engine. |
| `Dataset_rPPG-10/`, `validation_output/`, `signal_validation/`, `p11_validation/` | Artefak validasi/eksperimen — dilarang ikut dipindahkan. |
| `rppg_sessions.db`, `benchmark_results/`, `__pycache__/`, `null` | Database, cache, dan artefak runtime — tidak relevan untuk engine. |
| `p3_spatial/` … `p10_stress_lab/`, `benchmarks/`, `scripts/` | Paket fase eksperimen; tidak diimpor engine. |

---

## 2. Dependency map (internal)

```
rppg_core.py
 ├── rppg_config.py        (cfg)
 ├── rppg_algorithms.py    (get_algorithm_by_name)
 ├── rppg_temporal.py      (KalmanBPMFilter, ProbabilisticFusion)
 ├── rppg_sqi.py           (StatisticallyCalibratedSQI, LearnedWeighting)
 ├── rppg_physio_state.py  (PhysiologicalStateClassifier, PantingAdaptiveHR, PhysioState, PhysioStateResult)
 ├── rppg_signal.py        (apply_windowing, mature_harmonic_rejection,
 │                           respiratory_interference_analysis, estimate_respiratory_rate,
 │                           extract_pos_with_phase, phase_coherence_cardiac_fraction,
 │                           OpticalFlowROIStabilizer, PulseRichPixelSelector)
 ├── rppg_uncertainty.py   (UncertaintyAwareConfidence, propagate_variance)
 ├── rppg_roi.py           (AdaptiveROIManager)
 └── rppg_benchmark.py     (ReproducibilityProtocol)
```

Modul selain `rppg_core.py` **tidak mengimpor modul engine lain** — tidak ada siklus impor
dan tidak ada modul engine ke-11 yang tersembunyi. Impor di luar paket (mis. `import
mediapipe`, `from rppg_vitals import …`) **tidak ditemukan** pada 10 modul ini.

## 3. Dependency eksternal

| Paket | Dipakai oleh | Keterangan |
|---|---|---|
| `numpy` | semua modul | |
| `scipy` | `rppg_core`, `rppg_sqi`, `rppg_signal`, `rppg_physio_state`, `rppg_algorithms`, `rppg_benchmark` | `scipy.signal`, `scipy.stats` |
| `opencv-python` (`cv2`) | `rppg_core`, `rppg_signal`, `rppg_roi` | |
| `scikit-learn` (`sklearn.decomposition.FastICA`) | `rppg_algorithms` | Import level modul → **wajib**, bukan opsional |

`mediapipe` **tidak** dibutuhkan oleh paket ini dan sengaja tidak dimasukkan.
Snapshot environment acuan: conda env `rppg_env` (Phase 9.0 mencatat NumPy 2.2.6,
SciPy 1.15.3, OpenCV 4.13.0.92). Versi `scikit-learn` yang dipakai env acuan
**tidak tercatat** di repositori, sehingga batas bawah `scikit-learn>=1.3.0` di
`requirements.txt` adalah pilihan migrasi, bukan angka terverifikasi.

## 4. Pemasangan

```bash
# 1) dependensi
pip install -r migration_package/requirements.txt

# 2) salin 10 modul ke lokasi import target, mis.
cp migration_package/rppg_*.py /path/ke/sanubari/

# 3) (opsional) bila modul disimpan di subfolder, tambahkan ke sys.path:
export PYTHONPATH=/path/ke/sanubari/rppg

# 4) cek impor (bukan tes):
python -c "from rppg_core import MultiROIFusionEngineV2; print('import ok')"
```

## 5. Interface aktual — `MultiROIFusionEngineV2`

Semua di `rppg_core.py`. V2 mewarisi `MultiROIFusionEngine` (V1, tanpa argumen constructor).

### 5.1 Constructor

```python
class MultiROIFusionEngineV2(MultiROIFusionEngine):
    def __init__(self, enable_logging: bool = False)
```

- `enable_logging=False` (default): tidak mengaktifkan `ReproducibilityLogger`.
- `enable_logging=True`: menyalakan `ReproducibilityLogger` yang menulis ke folder
  `rppg_session_<unix_ts>/` (dibuat saat pemanggilan, bukan saat import).
- Objek di dalam engine (dibuat di `__init__`): `SkinConfidenceMap`, `PerPixelQualityFilter`,
  `ROIMicroMotionDetector`, `MethodArbitrator`, `TimestampResampler(target_fps=30.0)`,
  `RollingConfidenceTrend(window_sec=20)`, `RespiratoryArtifactSuppressor`, `HeadPoseGate`,
  `JawBlinkSuppressor`.
- Dari V1: `ROISignal` untuk 3 ROI (`forehead`, `cheek_left`, `cheek_right`),
  `SkinToneCalibrator`, `MotionArtifactDetector`, `ExposureCompensator`, `BPMSmoother`,
  `BPMMedianStabilizer(window=10)`, `SessionConfidenceScorer`, `CalibrationPhase`,
  `ProbabilisticFusion`, `StatisticallyCalibratedSQI`, `LearnedWeighting`,
  `UncertaintyAwareConfidence`, `AdaptiveROIManager`, `PhysiologicalStateClassifier`,
  `PantingAdaptiveHR`, `OpticalFlowROIStabilizer`/ROI, `PulseRichPixelSelector`/ROI,
  `ReproducibilityProtocol`.

### 5.2 `update()`

```python
def update(self, frame, face_landmarks, h, w) -> FrameResult
```

| Parameter | Tipe | Arti |
|---|---|---|
| `frame` | `np.ndarray` (BGR uint8) | Frame kamera; di internally di-gray-kan untuk deteksi gerak |
| `face_landmarks` | `object | None` | Landmark MediaPipe (468 titik); `None` = wajah tidak terdeteksi |
| `h`, `w` | `int` | tinggi & lebar frame |

Mengembalikan `FrameResult` (§5.5). Alur internal: deteksi gerak → gate drift eksposur →
gate pose kepala → ROI polygon + skin coverage + stabilisasi optical-flow + filter piksel →
buffer RGB per ROI → resampling 30 fps → per ROI (arbitrator kanal → detrend → normalisasi
eksposur → suppressor respirasi → bandpass → `estimate_bpm_fft` → `calculate_sqi` →
`compute_sqi` → gate regularitas + rehab ROI) → kandidat 3-tier → `cross_roi_harmonic_check`
→ bobot dinamis × `LearnedWeighting` → `ProbabilisticFusion` + `hierarchical_fusion`
(0.7/0.3) → `BPMSmoother` → `BPMMedianStabilizer` → `fused_bpm` / `fused_sqi` →
`SessionConfidenceScorer`.

Fungsi helper level-modul yang sering dipakai integrator:
`estimate_bpm_fft(signal, fps, roi_name="") -> (bpm, freqs, power, fft_validation)`,
`compute_sqi(signal, fps, peak_bpm, motion_score=0.0, mean_brightness=128.0,
roi_brightness=-1.0, fft_validation=None, prev_sqi=-1.0, roi_obj=None,
exposure_drift=0.0, roi_name="") -> (sqi, breakdown)`,
`_resolve_subharmonic(fft_v, freqs, mask, candidate_hz, prev_bpm=None)`.

### 5.3 `get_diagnostics()`

```python
def get_diagnostics(self) -> dict
```

Kunci: `method_wins`, `confidence_trend`, `skin_type`, `session_confidence`,
`calibration_done`, `baseline_sqi`, `last_pose` (`yaw`, `pitch`, `ok`), `jaw_state`,
`per_roi_sqi`, `per_roi_weight`, `physio_state`, `resp_rate_bpm`.

### 5.4 `reset()`

```python
def reset(self)
```

Memanggil `MultiROIFusionEngine.reset()` lalu membersihkan state V2:
`micro_motion`, `pixel_filter`, `resampler`, `conf_trend._sqi_history`,
`resp_suppressor._resp_history`, `pose_gate._yaw_history`/`_pitch_history`,
`jaw_suppressor._jaw_history`/`_blink_history`/`_jaw_baseline`.

### 5.5 Struktur hasil — `FrameResult` (dataclass, `rppg_core.py`)

| Field | Tipe | Default | Keterangan |
|---|---|---|---|
| `fused_bpm` | `float` | `0.0` | BPM hasil fusion + smoothing + stabilisasi |
| `fused_sqi` | `float` | `0.0` | SQI 0–100 hasil fusion berbobot |
| `roi_signals` | `dict[str, ROISignal]` | `{}` | State per ROI (`forehead`, `cheek_left`, `cheek_right`) |
| `chrom_signal` | `np.ndarray` | `[]` | Sinyal tak-terfilter (band respirasi utuh) |
| `motion_score` | `float` | `0.0` | Skor gerak frame ini |
| `motion_rejected` | `bool` | `False` | True bila `motion_detector.is_moving` |
| `skin_tone_factor` | `float` | `1.0` | Faktor normalisasi kanal hijau |
| `frame_brightness` | `float` | `128.0` | Brightness ternormalisasi |
| `freqs`, `power` | `np.ndarray` | `[]` | Spektrum ROI dengan SQI terbaik |
| `sqi_breakdown` | `dict` | `{}` | Komponen SQI (`snr`, `regularity`, `variance`, `motion_penalty`, `lighting_penalty`, `fft_penalty`, `overall`, `temporal_stability`, `peak_consistency`) |
| `session_confidence` | `float` | `0.0` | Confidence sesi 0–1 |
| `roi_agreement` | `float` | `1.0` | Kesesuaian antar-ROI |
| `exposure_drift` | `float` | `0.0` | Magnitude drift eksposur |
| `brightness_normalized` | `bool` | `False` | True bila drift terdeteksi |
| `in_calibration` | `bool` | `False` | Fase kalibrasi SQI baseline |
| `output_frozen` | `bool` | `False` | Output dibekukan karena drift eksposur |
| `n_valid_rois` | `int` | `0` | Jumlah ROI yang diterima |
| `bpm_locked` | `bool` | `False` | BPM terkunci (lompatan > 30 BPM) |
| `top3_peaks` | `list` | `[]` | Kandidat puncak spektrum |
| `subharm_corrected` | `bool` | `False` | Koreksi subharmonik diterapkan |
| `physio_state` | `str` | `"RESTING"` | State fisiologis |
| `resp_rate_bpm` | `float` | `0.0` | Laju napas |
| `cardiac_fraction` | `float` | `1.0` | Pecahan energi kardial |
| `cardiac_signal` | `np.ndarray` | `[]` | Sinyal terfilter band kardial |
| `resp_signal` | `np.ndarray` | `[]` | Sinyal dengan band respirasi utuh |
| `_diag_detector_is_moving` | `bool` | `False` | State otoritatif detektor gerak |
| `_diag_grace_counter` | `int` | `0` | Counter grace motion |
| `_diag_score_at_decision` | `float` | `0.0` | Skor gerak saat keputusan diambil |
| `_diag_was_local_stale` | `bool` | `False` | True bila nilai lokal sudah basi |
| `_diag_override_fired` | `bool` | `False` | V1: apakah override berbasis state basi terpicu (selalu `False` di V2) |

Field tambahan yang diisi engine di luar definisi dataclass (di-set saat runtime, accessor
`getattr`): `_diag_score_ema`, `_diag_landmarks_valid`, `_diag_frames_since_mp`,
`_diag_landmarks_cached`.

`ROISignal` (per ROI di `roi_signals`): `name`, `buf_r/buf_g/buf_b` (deque `maxlen=BUFFER_SIZE=300`),
`sqi`, `bpm`, `pts`, `bbox`, `valid`, `roi_brightness`, `roi_motion_stability`, `roi_snr` (dB),
`roi_regularity`, `dynamic_weight`, `skin_coverage`, `agreement_factor`,
`is_harmonic_suspect`, `_reg_history`, `_var_history`, `_bpm_history`, `_bad_streak`,
`_excluded_until`, `_prev_bpm`, `_sqi_breakdown`.

### 5.6 Contoh pemakaian minimal

```python
from rppg_core import MultiROIFusionEngineV2

engine = MultiROIFusionEngineV2()
result = engine.update(frame_bgr, face_landmarks, h, w)

print(result.fused_bpm, result.fused_sqi, result.session_confidence)
print(result.sqi_breakdown)
engine.reset()
```

`face_landmarks` boleh `None` (engine mengembalikan `FrameResult` dengan ROI kosong dan
`fused_bpm = 0.0`). Pipeline landmark (MediaPipe) **tidak** disertakan — Sanubari harus
menyediakan landmark sendiri.

## 6. Batasan yang diketahui (dari dokumen freeze Phase 9.1)

- Fundamental vs. harmonik belum terselesaikan total; aturan Phase 9.1 (`promo_thresh = 1.0`
  di `_resolve_subharmonic`) sengaja mengutamakan laju lebih rendah → subjek cepat
  (≈90–105 BPM) berpotensi under-report.
- `_pick_one_peak()` bergantung pada `prev_bpm` → estimasi path-dependent antar-frame.
- Key `harmonic_resolution` (`none`/`halved`/`doubled`) tersedia di dict validasi FFT.
- SQI ada dua metrik yang berbeda skala: `compute_sqi()["regularity"]` (CV-based, 0–100)
  dan `PosteriorSQI.regularity_score` (ACF-based) — jangan diperlakukan sebagai kuantitas
  fisiologis yang sama.
- `roi_snr` bersatuan **dB** (bukan 0–100), konsisten dengan `cfg.SNR_KILL_THRESHOLD = 20.0`.

## 7. Batasan paket

- **Belum divalidasi tes/benchmark** — tidak ada tes yang dijalankan, tidak ada benchmark.
- Snapshot environment tidak terkunci; `requirements.txt` hanya batas bawah.
- `models/face_landmarker.task` tidak disertakan; MediaPipe tidak dipasang.
- Modul benchmark/ablation di `rppg_benchmark.py` ikut terbawa karena `rppg_core` mengimpor
  `ReproducibilityProtocol` dari berkas yang sama — tidak ada pemisahan file di sumber.
