#!/usr/bin/env python3
"""
Generate Label Studio task split files with hybrid overlap.

Hybrid mode behavior:
- A configurable percentage of samples are marked as overlapping samples.
- Overlapping samples are seen by N tasks (e.g., 3 tasks).
- Non-overlapping samples are seen by exactly 1 task.

This combines:
- Percentage-controlled overlap coverage
- Exact reviewer multiplicity for the overlap subset

Example:
python3 scripts/generate_hybrid_overlap_tasks.py \
    --sample-count 2000 \
    --task-count 5 \
    --overlap-percent 10 \
    --reviewers-per-overlap 3 \
    --base-url https://labeldataus001.blob.core.windows.net/data/afdata/ \
    --output-dir ./tasks_hybrid
"""

import argparse
import json
import os
import sys
from typing import Dict, List, Set


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description=(
            "Generate Label Studio task JSON files with hybrid overlap: "
            "some samples reviewed by N tasks and others by one task."
        )
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
        help="Number of task files to generate (e.g., 5 -> task_0.json ... task_4.json)",
    )
    parser.add_argument(
        "--overlap-percent",
        type=float,
        required=True,
        help="Percentage of samples that should be overlap samples (0 to 100).",
    )
    parser.add_argument(
        "--reviewers-per-overlap",
        type=int,
        default=3,
        help="How many tasks each overlap sample appears in (default: 3).",
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

    if args.overlap_percent < 0 or args.overlap_percent > 100:
        print("Error: --overlap-percent must be in [0, 100]", file=sys.stderr)
        sys.exit(1)

    if args.reviewers_per_overlap <= 0:
        print("Error: --reviewers-per-overlap must be > 0", file=sys.stderr)
        sys.exit(1)

    if args.reviewers_per_overlap > args.task_count:
        print(
            "Error: --reviewers-per-overlap cannot be greater than --task-count",
            file=sys.stderr,
        )
        sys.exit(1)

    if not args.base_url:
        print("Error: --base-url is required", file=sys.stderr)
        sys.exit(1)


def build_unique_chunks(sample_count: int, task_count: int) -> List[List[int]]:
    """Split samples into task_count contiguous chunks for single-review assignment."""
    boundaries = [(i * sample_count) // task_count for i in range(task_count + 1)]
    chunks: List[List[int]] = []

    for i in range(task_count):
        start = boundaries[i]
        end = boundaries[i + 1]
        chunks.append(list(range(start, end)))

    return chunks


def choose_overlap_indices(sample_count: int, overlap_count: int) -> Set[int]:
    """
    Select overlap sample indices spread across the full range.

    Uses evenly-spaced picks to avoid concentrating overlap in only one region/task.
    """
    if overlap_count <= 0:
        return set()

    if overlap_count >= sample_count:
        return set(range(sample_count))

    selected: Set[int] = set()
    for i in range(overlap_count):
        idx = (i * sample_count) // overlap_count
        selected.add(idx)

    # Fill possible gaps if integer division collisions occurred.
    candidate = 0
    while len(selected) < overlap_count:
        if candidate not in selected:
            selected.add(candidate)
        candidate += 1

    return selected


def owner_task_for_sample(sample_index: int, sample_count: int, task_count: int) -> int:
    """Return the owner task index for a sample using chunk boundaries."""
    task_index = (sample_index * task_count) // sample_count
    if task_index >= task_count:
        return task_count - 1
    return task_index


def build_assignments(
    sample_count: int,
    task_count: int,
    overlap_indices: Set[int],
    reviewers_per_overlap: int,
) -> List[List[int]]:
    """
    Build task assignments.

    Rules:
    - Every sample is assigned to exactly one owner task.
    - If sample is in overlap_indices, it is also assigned to next (N-1) tasks circularly.
    """
    assignments: List[List[int]] = [[] for _ in range(task_count)]

    for sample_index in range(sample_count):
        owner = owner_task_for_sample(sample_index, sample_count, task_count)
        assignments[owner].append(sample_index)

        if sample_index in overlap_indices:
            for offset in range(1, reviewers_per_overlap):
                extra_task = (owner + offset) % task_count
                assignments[extra_task].append(sample_index)

    return assignments


def build_sample_url(
    base_url: str,
    sample_prefix: str,
    sample_index: int,
    sample_extension: str,
) -> str:
    """Build sample URL from parts."""
    return f"{base_url}{sample_prefix}{sample_index}{sample_extension}"


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


def validate_coverage(
    assignments: List[List[int]],
    sample_count: int,
    overlap_indices: Set[int],
    reviewers_per_overlap: int,
) -> None:
    """Validate per-sample coverage counts for hybrid behavior."""
    counts = [0] * sample_count
    for task_indices in assignments:
        for sample_index in task_indices:
            counts[sample_index] += 1

    bad_samples: List[int] = []
    for sample_index, count in enumerate(counts):
        expected = reviewers_per_overlap if sample_index in overlap_indices else 1
        if count != expected:
            bad_samples.append(sample_index)

    if bad_samples:
        first_few = ", ".join(str(i) for i in bad_samples[:10])
        print(
            "Error: coverage validation failed. "
            f"Samples with incorrect coverage (first 10): {first_few}",
            file=sys.stderr,
        )
        sys.exit(1)


def main() -> None:
    """Script entry point."""
    args = parse_arguments()
    validate_arguments(args)

    overlap_count = int(round(args.sample_count * (args.overlap_percent / 100.0)))
    overlap_indices = choose_overlap_indices(args.sample_count, overlap_count)

    assignments = build_assignments(
        sample_count=args.sample_count,
        task_count=args.task_count,
        overlap_indices=overlap_indices,
        reviewers_per_overlap=args.reviewers_per_overlap,
    )

    validate_coverage(
        assignments=assignments,
        sample_count=args.sample_count,
        overlap_indices=overlap_indices,
        reviewers_per_overlap=args.reviewers_per_overlap,
    )

    os.makedirs(args.output_dir, exist_ok=True)

    print(
        "Generating hybrid task files: "
        f"samples={args.sample_count}, tasks={args.task_count}, "
        f"overlap_percent={args.overlap_percent}%, "
        f"overlap_samples={len(overlap_indices)}, "
        f"reviewers_per_overlap={args.reviewers_per_overlap}"
    )

    total_entries = 0

    for task_index, indices in enumerate(assignments):
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
        f"Done. Generated {args.task_count} files in '{args.output_dir}' with "
        f"{total_entries} total task items."
    )
    print(
        "Coverage check passed: overlap samples appear "
        f"{args.reviewers_per_overlap} times and non-overlap samples appear once."
    )


if __name__ == "__main__":
    main()
