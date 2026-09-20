"""
OPD Flow - Offline Prediction Engine Evaluation Tool
===================================================
Evaluates the data-driven waiting-time prediction engine across
independent synthetic OPD scenarios.

Key Guarantees:
- Reproducible random seed (seed=42).
- Zero data leakage: Prediction only uses data available at observation time.
- Standard metrics: MAE, RMSE, Mean Signed Bias, Median Absolute Error, Range Coverage.
- Subgroup stratification: by queue size (0-2, 3-5, 6+) and by time-of-day.
- Generates CSV, JSON report, and visualization chart.
"""

import os
import sys
import json
import csv
import math
import random
from typing import List, Dict, Any

# Ensure backend root is on sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.prediction import (
    compute_robust_duration,
    DEFAULT_CONSULTATION_DURATION_MINUTES,
    PAUSED_DOCTOR_BUFFER_MINUTES,
    MIN_SAMPLE_REQUIREMENT_OVERALL,
    MIN_SAMPLE_REQUIREMENT_TIME_OF_DAY
)

RESULTS_DIR = os.path.join(CURRENT_DIR, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

def simulate_prediction(
    historical_records: List[Dict[str, Any]],
    current_tod: str,
    doctor_status: str,
    has_active_patient: bool,
    active_elapsed_minutes: float,
    patients_ahead_count: int,
) -> Dict[str, Any]:
    """
    Executes the exact application prediction logic using only observed information.
    Zero data leakage: does not receive actual future durations.
    """
    # 1. Expected doctor duration calculation
    records_durations = [r["duration"] for r in historical_records]
    if not records_durations or len(records_durations) < MIN_SAMPLE_REQUIREMENT_OVERALL:
        expected_duration = DEFAULT_CONSULTATION_DURATION_MINUTES
        calc_method = "default_fallback"
    else:
        tod_durations = [
            r["duration"] for r in historical_records 
            if r.get("time_of_day", "").upper() == current_tod.upper()
        ]
        if len(tod_durations) >= MIN_SAMPLE_REQUIREMENT_TIME_OF_DAY:
            expected_duration = compute_robust_duration(tod_durations)
            calc_method = f"time_of_day_{current_tod.lower()}_trimmed_mean"
        else:
            expected_duration = compute_robust_duration(records_durations)
            calc_method = "doctor_overall_trimmed_mean"

    # 2. Remaining active consultation time (strictly non-negative)
    if has_active_patient:
        remaining_active = max(0.0, round(expected_duration - active_elapsed_minutes, 1))
    elif doctor_status == "BUSY":
        remaining_active = max(0.0, round(expected_duration / 2.0, 1))
    else:
        remaining_active = 0.0

    # 3. Status adjustment
    status_adjustment = PAUSED_DOCTOR_BUFFER_MINUTES if doctor_status == "PAUSED" else 0.0

    # 4. Total wait and range
    total_wait = remaining_active + (patients_ahead_count * expected_duration) + status_adjustment
    total_wait = max(0.0, total_wait)

    if patients_ahead_count == 0 and not has_active_patient and doctor_status == "AVAILABLE":
        pred_minutes = 0
        range_min = 0
        range_max = 2
    else:
        pred_minutes = max(0, int(round(total_wait)))
        range_min = max(0, int(round(total_wait * 0.80)))
        range_max = max(pred_minutes + 1, int(round(total_wait * 1.25)))

    return {
        "predicted_wait_minutes": pred_minutes,
        "predicted_range_min": range_min,
        "predicted_range_max": range_max,
        "expected_duration": expected_duration,
        "active_remaining_minutes": remaining_active,
        "status_adjustment_minutes": status_adjustment,
        "calculation_method": calc_method
    }

def generate_synthetic_scenarios(num_scenarios: int = 1000, seed: int = 42) -> List[Dict[str, Any]]:
    """
    Generates independent, reproducible synthetic OPD scenarios.
    """
    random.seed(seed)
    scenarios = []

    time_slots = ["MORNING", "AFTERNOON", "EVENING"]
    slot_weights = [0.45, 0.40, 0.15]

    for scenario_id in range(1, num_scenarios + 1):
        tod = random.choices(time_slots, weights=slot_weights)[0]

        # Doctor clinical baseline distribution
        # Mean duration varies realistically by doctor and shift (e.g. 6.5 to 9.5 mins)
        base_mean = random.uniform(6.8, 8.5)
        if tod == "MORNING":
            shift_mean = base_mean - 0.4
        elif tod == "AFTERNOON":
            shift_mean = base_mean + 0.3
        else:
            shift_mean = base_mean + 0.6
        shift_std = random.uniform(1.8, 2.5)

        # 1. Generate prior historical completed visits (available at prediction time)
        num_past_records = random.randint(15, 60)
        historical_records = []
        for _ in range(num_past_records):
            record_tod = random.choice(time_slots)
            # Sample past duration from realistic gamma/lognormal distribution
            dur = max(3.0, round(random.gauss(shift_mean, shift_std), 1))
            historical_records.append({"duration": dur, "time_of_day": record_tod})

        # 2. Patients ahead distribution across queue sizes:
        # Balanced sampling across 0-2, 3-5, 6-12
        category = random.choices(["small", "medium", "large"], weights=[0.35, 0.40, 0.25])[0]
        if category == "small":
            patients_ahead = random.randint(0, 2)
        elif category == "medium":
            patients_ahead = random.randint(3, 5)
        else:
            patients_ahead = random.randint(6, 12)

        # 3. Doctor status & active consultation state
        is_paused = random.random() < 0.08  # 8% break probability
        has_active_patient = (patients_ahead > 0 and random.random() < 0.90) or (patients_ahead == 0 and random.random() < 0.40)

        if is_paused:
            doctor_status = "PAUSED"
            pause_duration = max(5.0, round(random.gauss(10.0, 2.0), 1))
        elif has_active_patient:
            doctor_status = "BUSY"
            pause_duration = 0.0
        else:
            doctor_status = "AVAILABLE"
            pause_duration = 0.0

        # 4. Active patient actual vs elapsed times (if applicable)
        if has_active_patient:
            actual_active_total_dur = max(3.0, round(random.gauss(shift_mean, shift_std), 1))
            # Elapsed time observed so far (must be < actual total)
            active_elapsed = round(random.uniform(0.5, max(0.6, actual_active_total_dur - 0.2)), 1)
            actual_active_remaining = max(0.0, actual_active_total_dur - active_elapsed)
        else:
            actual_active_total_dur = 0.0
            active_elapsed = 0.0
            actual_active_remaining = 0.0

        # 5. Future consultation durations for patients ahead (GROUND TRUTH)
        ahead_actual_durations = []
        for _ in range(patients_ahead):
            d = max(3.0, round(random.gauss(shift_mean, shift_std), 1))
            ahead_actual_durations.append(d)

        # 6. Actual ground-truth wait time for this patient to be called
        actual_wait_minutes = round(actual_active_remaining + sum(ahead_actual_durations) + pause_duration, 1)

        # 7. Execute prediction using ONLY visible information (NO FUTURE DURATION ACCESS)
        pred_res = simulate_prediction(
            historical_records=historical_records,
            current_tod=tod,
            doctor_status=doctor_status,
            has_active_patient=has_active_patient,
            active_elapsed_minutes=active_elapsed,
            patients_ahead_count=patients_ahead
        )

        pred_wait = pred_res["predicted_wait_minutes"]
        abs_error = round(abs(pred_wait - actual_wait_minutes), 2)
        signed_error = round(pred_wait - actual_wait_minutes, 2)
        inside_range = pred_res["predicted_range_min"] <= actual_wait_minutes <= pred_res["predicted_range_max"]

        scenarios.append({
            "scenario_id": scenario_id,
            "time_of_day": tod,
            "doctor_status": doctor_status,
            "patients_ahead": patients_ahead,
            "has_active_patient": has_active_patient,
            "active_elapsed_minutes": active_elapsed,
            "historical_sample_size": num_past_records,
            "historical_expected_duration": pred_res["expected_duration"],
            "calculation_method": pred_res["calculation_method"],
            "predicted_wait_minutes": pred_wait,
            "predicted_range_min": pred_res["predicted_range_min"],
            "predicted_range_max": pred_res["predicted_range_max"],
            "actual_wait_minutes": actual_wait_minutes,
            "absolute_error_minutes": abs_error,
            "signed_error_minutes": signed_error,
            "inside_range": inside_range
        })

    return scenarios

def compute_group_metrics(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Computes MAE, RMSE, bias, median absolute error, and range coverage for a subset of rows."""
    if not rows:
        return {}

    n = len(rows)
    abs_errors = [r["absolute_error_minutes"] for r in rows]
    signed_errors = [r["signed_error_minutes"] for r in rows]
    sq_errors = [e ** 2 for e in signed_errors]
    range_hits = sum(1 for r in rows if r["inside_range"])

    mae = round(sum(abs_errors) / n, 2)
    rmse = round(math.sqrt(sum(sq_errors) / n), 2)
    mean_bias = round(sum(signed_errors) / n, 2)

    # Median absolute error
    sorted_abs = sorted(abs_errors)
    if n % 2 == 1:
        med_ae = sorted_abs[n // 2]
    else:
        med_ae = round((sorted_abs[n // 2 - 1] + sorted_abs[n // 2]) / 2.0, 2)

    coverage_pct = round((range_hits / n) * 100.0, 1)

    return {
        "samples": n,
        "mae_minutes": mae,
        "rmse_minutes": rmse,
        "mean_bias_minutes": mean_bias,
        "median_absolute_error_minutes": med_ae,
        "range_coverage_percent": coverage_pct
    }

def run_evaluation(num_scenarios: int = 1000, seed: int = 42) -> Dict[str, Any]:
    print(f"=== OPD Flow Waiting-Time Prediction Evaluation ===")
    print(f"Generating {num_scenarios} independent synthetic OPD scenarios (seed={seed})...")

    scenarios = generate_synthetic_scenarios(num_scenarios, seed)

    # Sanity checks
    for s in scenarios:
        assert s["predicted_wait_minutes"] >= 0, f"Negative predicted wait: {s}"
        assert s["actual_wait_minutes"] >= 0, f"Negative actual wait: {s}"
        assert not math.isnan(s["absolute_error_minutes"]), f"NaN error: {s}"

    # Save detailed CSV
    csv_path = os.path.join(RESULTS_DIR, "evaluation_results.csv")
    fieldnames = [
        "scenario_id", "time_of_day", "doctor_status", "patients_ahead",
        "has_active_patient", "active_elapsed_minutes", "historical_sample_size",
        "historical_expected_duration", "calculation_method",
        "predicted_wait_minutes", "predicted_range_min", "predicted_range_max",
        "actual_wait_minutes", "absolute_error_minutes", "signed_error_minutes",
        "inside_range"
    ]

    with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in scenarios:
            writer.writerow(row)
    print(f"Saved scenario results to: {csv_path}")

    # Compute overall metrics
    overall_metrics = compute_group_metrics(scenarios)

    # Breakdown by queue size
    g_0_2 = [r for r in scenarios if r["patients_ahead"] <= 2]
    g_3_5 = [r for r in scenarios if 3 <= r["patients_ahead"] <= 5]
    g_6_plus = [r for r in scenarios if r["patients_ahead"] >= 6]

    by_queue_size = {
        "0_to_2_patients_ahead": compute_group_metrics(g_0_2),
        "3_to_5_patients_ahead": compute_group_metrics(g_3_5),
        "6_plus_patients_ahead": compute_group_metrics(g_6_plus),
    }

    # Breakdown by time of day
    by_tod = {
        "MORNING": compute_group_metrics([r for r in scenarios if r["time_of_day"] == "MORNING"]),
        "AFTERNOON": compute_group_metrics([r for r in scenarios if r["time_of_day"] == "AFTERNOON"]),
        "EVENING": compute_group_metrics([r for r in scenarios if r["time_of_day"] == "EVENING"]),
    }

    report = {
        "samples": overall_metrics["samples"],
        "mae_minutes": overall_metrics["mae_minutes"],
        "rmse_minutes": overall_metrics["rmse_minutes"],
        "mean_bias_minutes": overall_metrics["mean_bias_minutes"],
        "median_absolute_error_minutes": overall_metrics["median_absolute_error_minutes"],
        "range_coverage_percent": overall_metrics["range_coverage_percent"],
        "by_queue_size": by_queue_size,
        "by_time_of_day": by_tod,
        "evaluation_notes": {
            "data_leakage_prevented": True,
            "description": "Offline empirical validation on independent synthetic OPD scenarios using identical prediction logic."
        }
    }

    json_path = os.path.join(RESULTS_DIR, "evaluation_report.json")
    with open(json_path, mode="w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Saved JSON report to: {json_path}")

    # Generate Chart if matplotlib is available
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        # 1. Scatter Plot: Predicted vs Actual Wait
        preds = [s["predicted_wait_minutes"] for s in scenarios]
        actuals = [s["actual_wait_minutes"] for s in scenarios]
        ahead_colors = [
            "#10b981" if s["patients_ahead"] <= 2 
            else "#3b82f6" if s["patients_ahead"] <= 5 
            else "#8b5cf6" 
            for s in scenarios
        ]

        ax1.scatter(actuals, preds, c=ahead_colors, alpha=0.45, edgecolors="none", s=22)
        max_val = max(max(actuals), max(preds)) + 5
        ax1.plot([0, max_val], [0, max_val], color="#ef4444", linestyle="--", linewidth=1.5, label="Perfect Agreement (y = x)")
        ax1.set_xlim(0, max_val)
        ax1.set_ylim(0, max_val)
        ax1.set_xlabel("Actual Ground-Truth Wait (minutes)", fontsize=11, fontweight="bold")
        ax1.set_ylabel("Predicted Wait (minutes)", fontsize=11, fontweight="bold")
        ax1.set_title(f"Predicted vs Actual Waiting Time (N={num_scenarios})", fontsize=12, fontweight="bold")
        ax1.grid(True, linestyle=":", alpha=0.6)
        ax1.legend(loc="upper left")

        # 2. Error Distribution by Queue Size
        queue_groups = ["0–2 Ahead", "3–5 Ahead", "6+ Ahead"]
        maes = [
            by_queue_size["0_to_2_patients_ahead"]["mae_minutes"],
            by_queue_size["3_to_5_patients_ahead"]["mae_minutes"],
            by_queue_size["6_plus_patients_ahead"]["mae_minutes"],
        ]
        rmses = [
            by_queue_size["0_to_2_patients_ahead"]["rmse_minutes"],
            by_queue_size["3_to_5_patients_ahead"]["rmse_minutes"],
            by_queue_size["6_plus_patients_ahead"]["rmse_minutes"],
        ]

        x_pos = range(len(queue_groups))
        width = 0.35
        ax2.bar([p - width/2 for p in x_pos], maes, width=width, label="MAE (Mean Absolute Error)", color="#3b82f6")
        ax2.bar([p + width/2 for p in x_pos], rmses, width=width, label="RMSE (Root Mean Sq. Error)", color="#6366f1")

        for i, v in enumerate(maes):
            ax2.text(i - width/2, v + 0.2, f"{v}m", ha="center", fontsize=9, fontweight="bold")
        for i, v in enumerate(rmses):
            ax2.text(i + width/2, v + 0.2, f"{v}m", ha="center", fontsize=9, fontweight="bold")

        ax2.set_xticks(list(x_pos))
        ax2.set_xticklabels(queue_groups, fontweight="bold")
        ax2.set_ylabel("Error (minutes)", fontsize=11, fontweight="bold")
        ax2.set_title("Error Progression by Queue Size", fontsize=12, fontweight="bold")
        ax2.grid(axis="y", linestyle=":", alpha=0.6)
        ax2.legend()

        plt.suptitle("OPD Flow Waiting-Time Prediction Offline Evaluation", fontsize=14, fontweight="bold", y=0.98)
        plt.tight_layout()

        chart_path = os.path.join(RESULTS_DIR, "predicted_vs_actual.png")
        plt.savefig(chart_path, dpi=180)
        plt.close()
        print(f"Saved evaluation chart to: {chart_path}")
    except Exception as e:
        print(f"Chart generation skipped: {e}")

    # Print summary table
    print("\n" + "="*60)
    print(f"EVALUATION SUMMARY (N={overall_metrics['samples']} scenarios)")
    print("="*60)
    print(f"Mean Absolute Error (MAE):       {overall_metrics['mae_minutes']} minutes")
    print(f"Root Mean Squared Error (RMSE):  {overall_metrics['rmse_minutes']} minutes")
    print(f"Median Absolute Error:           {overall_metrics['median_absolute_error_minutes']} minutes")
    print(f"Mean Signed Bias:                {overall_metrics['mean_bias_minutes']:+} minutes")
    print(f"Prediction Range Coverage:       {overall_metrics['range_coverage_percent']}%")
    print("\n--- Breakdown by Queue Size ---")
    for k, v in by_queue_size.items():
        print(f"  {k:24}: N={v['samples']:3} | MAE={v['mae_minutes']:4.1f}m | RMSE={v['rmse_minutes']:4.1f}m | Coverage={v['range_coverage_percent']}%")
    print("\n--- Breakdown by Time of Day ---")
    for k, v in by_tod.items():
        print(f"  {k:24}: N={v['samples']:3} | MAE={v['mae_minutes']:4.1f}m | RMSE={v['rmse_minutes']:4.1f}m | Bias={v['mean_bias_minutes']:+4.1f}m")
    print("="*60)

    return report

if __name__ == "__main__":
    run_evaluation(num_scenarios=1000, seed=42)
