#!/usr/bin/env python3
"""
Generate Label Studio task split files where each sample is assigned to multiple reviewers.

Primary use case: 3-person overlap for reconciliation voting when two reviewers disagree.

Strategy:
- Partition samples into task_count circular chunks.
- Each task receives reviewers_per_sample consecutive chunks.
- This guarantees each sample appears in exactly reviewers_per_sample task files.

Example:
python3 scripts/generate_multi_reviewer_tasks.py \
    --sample-count 2000 \
    --task-count 5 \
    --reviewers-per-sample 3 \
    --base-url https://labeldataus001.blob.core.windows.net/data/afdata/ \
    --output-dir ./tasks_three_reviewer
"""

import argparse
import json
import os
import sys
from typing import Dict, List


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description=(
            "Generate Label Studio task JSON files with exact multi-reviewer coverage "
            "(e.g., 3 reviewers per sample)."
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
        "--reviewers-per-sample",
        type=int,
        default=3,
        help="Exact number of task files each sample should appear in (default: 3)",
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

    if args.reviewers_per_sample <= 0:
        print("Error: --reviewers-per-sample must be > 0", file=sys.stderr)
        sys.exit(1)

    if args.reviewers_per_sample > args.task_count:
        print(
            "Error: --reviewers-per-sample cannot be greater than --task-count",
            file=sys.stderr,
        )
        sys.exit(1)

    if not args.base_url:
        print("Error: --base-url is required", file=sys.stderr)
        sys.exit(1)


def build_chunks(sample_count: int, task_count: int) -> List[List[int]]:
    """
    Split [0..sample_count-1] into task_count circular chunks.

    Boundaries use integer division to distribute remainder as evenly as possible.
    """
    boundaries = [(i * sample_count) // task_count for i in range(task_count + 1)]
    chunks: List[List[int]] = []

    for i in range(task_count):
        start = boundaries[i]
        end = boundaries[i + 1]
        chunks.append(list(range(start, end)))

    return chunks


def get_task_indices(
    chunks: List[List[int]], task_index: int, reviewers_per_sample: int
) -> List[int]:
    """
    Build one task's sample indices from consecutive chunks in circular order.

    If reviewers_per_sample=3, task i gets chunks i, i+1, i+2 (mod task_count).
    """
    task_count = len(chunks)
    indices: List[int] = []

    for offset in range(reviewers_per_sample):
        chunk_index = (task_index + offset) % task_count
        indices.extend(chunks[chunk_index])

    return indices


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
    task_indices_list: List[List[int]], sample_count: int, expected_coverage: int
) -> None:
    """Validate that every sample appears exactly expected_coverage times."""
    counts = [0] * sample_count

    for indices in task_indices_list:
        for index in indices:
            counts[index] += 1

    bad_indices = [i for i, count in enumerate(counts) if count != expected_coverage]
    if bad_indices:
        first_few = ", ".join(str(i) for i in bad_indices[:10])
        print(
            "Error: coverage validation failed. "
            f"Samples with wrong coverage (first 10): {first_few}",
            file=sys.stderr,
        )
        sys.exit(1)


def main() -> None:
    """Script entry point."""
    args = parse_arguments()
    validate_arguments(args)

    chunks = build_chunks(sample_count=args.sample_count, task_count=args.task_count)

    os.makedirs(args.output_dir, exist_ok=True)

    print(
        "Generating multi-reviewer task files: "
        f"samples={args.sample_count}, tasks={args.task_count}, "
        f"reviewers_per_sample={args.reviewers_per_sample}"
    )

    task_indices_list: List[List[int]] = []

    for task_index in range(args.task_count):
        indices = get_task_indices(
            chunks=chunks,
            task_index=task_index,
            reviewers_per_sample=args.reviewers_per_sample,
        )
        task_indices_list.append(indices)

    validate_coverage(
        task_indices_list=task_indices_list,
        sample_count=args.sample_count,
        expected_coverage=args.reviewers_per_sample,
    )

    total_entries = 0

    for task_index, indices in enumerate(task_indices_list):
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
        "Coverage check passed: each sample appears exactly "
        f"{args.reviewers_per_sample} times."
    )


if __name__ == "__main__":
    main()
