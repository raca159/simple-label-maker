#!/usr/bin/env python3
"""
Generate Label Studio task split files with circular overlap.

This script creates files like task_0.json, task_1.json, ..., task_N.json where each
file contains a subset of samples and controlled overlap with neighboring tasks.

Example:
python3 scripts/generate_label_studio_tasks.py \
    --sample-count 2000 \
    --task-count 5 \
    --overlap-percent 10 \
    --base-url https://labeldataus001.blob.core.windows.net/data/afdata/ \
    --output-dir ./tasks
"""

import argparse
import json
import math
import os
import sys
from typing import Dict, List


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate Label Studio task JSON files with circular overlap"
    )
    parser.add_argument(
        "--sample-count",
        type=int,
        required=True,
        help="Total number of samples (e.g., 2000 for sample.0.csv to sample.1999.csv)",
    )
    parser.add_argument(
        "--task-count",
        type=int,
        required=True,
        help="Number of task files to generate (e.g., 20 -> task_0.json ... task_19.json)",
    )
    parser.add_argument(
        "--overlap-percent",
        type=float,
        default=0.0,
        help=(
            "Total overlap percentage relative to each core task chunk. "
            "Example: 5 means ~2.5%% overlap on each side."
        ),
    )
    parser.add_argument(
        "--base-url",
        required=True,
        help="Base URL prefix for samples, e.g. https://.../afdata/",
    )
    parser.add_argument(
        "--sample-prefix",
        default="sample.",
        help="Sample filename prefix (default: sample.)",
    )
    parser.add_argument(
        "--sample-extension",
        default=".csv",
        help="Sample filename extension (default: .csv)",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="First sample index (default: 0)",
    )
    parser.add_argument(
        "--data-field",
        default="csv_url",
        help="Data field key used in Label Studio task (default: csv_url)",
    )
    parser.add_argument(
        "--task-prefix",
        default="task_",
        help="Task output filename prefix (default: task_)",
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Directory where task files are written (default: current directory)",
    )
    parser.add_argument(
        "--id-prefix",
        default="task",
        help="Prefix used in generated item IDs (default: task)",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="JSON indentation spaces (default: 2)",
    )

    return parser.parse_args()


def validate_arguments(args: argparse.Namespace) -> None:
    """Validate input arguments and exit with an error if invalid."""
    if args.sample_count <= 0:
        print("Error: --sample-count must be > 0", file=sys.stderr)
        sys.exit(1)

    if args.task_count <= 0:
        print("Error: --task-count must be > 0", file=sys.stderr)
        sys.exit(1)

    if args.task_count > args.sample_count:
        print(
            "Error: --task-count cannot be greater than --sample-count",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.overlap_percent < 0:
        print("Error: --overlap-percent must be >= 0", file=sys.stderr)
        sys.exit(1)

    if not args.base_url:
        print("Error: --base-url is required", file=sys.stderr)
        sys.exit(1)


def build_sample_url(
    base_url: str,
    sample_prefix: str,
    sample_index: int,
    sample_extension: str,
) -> str:
    """Build sample URL from parts."""
    return f"{base_url}{sample_prefix}{sample_index}{sample_extension}"


def get_circular_indices(
    sample_count: int,
    task_index: int,
    task_count: int,
    overlap_percent: float,
) -> List[int]:
    """
    Get circular sample indices for a task.

    Strategy:
    - Split samples into task_count core chunks by rounded boundaries.
    - Expand each chunk by half overlap on both left/right sides.
    - Wrap around using circular indexing.
    """
    core_start = round(task_index * sample_count / task_count)
    core_end = round((task_index + 1) * sample_count / task_count)
    core_size = core_end - core_start

    overlap_each_side = int(
        math.ceil((core_size * (overlap_percent / 100.0)) / 2.0)
    )

    start = core_start - overlap_each_side
    end_exclusive = core_end + overlap_each_side

    indices: List[int] = []
    seen = set()

    for raw_index in range(start, end_exclusive):
        circular_index = raw_index % sample_count
        if circular_index not in seen:
            indices.append(circular_index)
            seen.add(circular_index)

    return indices


def build_task_payload(
    indices: List[int],
    task_index: int,
    args: argparse.Namespace,
) -> List[List[Dict[str, Dict[str, str]]]]:
    """Build nested Label Studio task payload for one task file."""
    payload: List[List[Dict[str, Dict[str, str]]]] = []

    for pos, sample_offset in enumerate(indices):
        sample_index = args.start_index + sample_offset
        sample_url = build_sample_url(
            base_url=args.base_url,
            sample_prefix=args.sample_prefix,
            sample_index=sample_index,
            sample_extension=args.sample_extension,
        )

        item = {
            "id": f"{args.id_prefix}_{task_index}_{pos}",
            "data": {
                args.data_field: sample_url,
            },
        }
        payload.append([item])

    return payload


def write_task_file(payload: List[List[Dict[str, Dict[str, str]]]], file_path: str, indent: int) -> None:
    """Write one task payload to JSON file."""
    with open(file_path, "w", encoding="utf-8") as out_file:
        json.dump(payload, out_file, indent=indent)
        out_file.write("\n")


def main() -> None:
    """Script entry point."""
    args = parse_arguments()
    validate_arguments(args)

    os.makedirs(args.output_dir, exist_ok=True)

    print(
        "Generating task files with circular overlap: "
        f"samples={args.sample_count}, tasks={args.task_count}, overlap={args.overlap_percent}%"
    )

    total_entries = 0

    for task_index in range(args.task_count):
        indices = get_circular_indices(
            sample_count=args.sample_count,
            task_index=task_index,
            task_count=args.task_count,
            overlap_percent=args.overlap_percent,
        )
        payload = build_task_payload(indices=indices, task_index=task_index, args=args)

        file_name = f"{args.task_prefix}{task_index}.json"
        file_path = os.path.join(args.output_dir, file_name)
        write_task_file(payload, file_path, args.indent)

        total_entries += len(payload)
        first_sample = args.start_index + indices[0]
        last_sample = args.start_index + indices[-1]
        print(
            f"Wrote {file_name}: {len(payload)} items "
            f"(first sample={first_sample}, last sample={last_sample})"
        )

    print(
        f"Done. Generated {args.task_count} files in '{args.output_dir}' with {total_entries} total task items."
    )


if __name__ == "__main__":
    main()
