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
python scripts/generate_hybrid_overlap_tasks.py \
    --sample-count 2000 \
    --task-count 6 \
    --overlap-percent 10 \
    --reviewers-per-overlap 3 \
    --sample-type time-series \
    --base-url https://SOMETHING.blob.core.windows.net/data/ \
    --output-dir ./tasks --metadata '{"channelCount": 10}'
"""

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Set


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description=(
            "Generate hybrid task JSON files where overlap samples are reviewed "
            "by N tasks and non-overlap samples by one task."
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
        "--output-format",
        choices=["simple-label-maker", "label-studio"],
        default="simple-label-maker",
        help=(
            "Output schema format (default: simple-label-maker). "
            "Use label-studio for nested Label Studio task format."
        ),
    )
    parser.add_argument(
        "--sample-type",
        choices=["image", "text", "audio", "video", "time-series"],
        default="time-series",
        help="Sample type used for simple-label-maker format (default: time-series).",
    )
    parser.add_argument(
        "--metadata",
        default="{}",
        help=(
            "JSON metadata to attach to each sample when output-format is "
            "simple-label-maker (e.g., '{\"channelCount\": 10}')."
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


def parse_metadata(metadata_str: str) -> Dict[str, Any]:
    """Parse metadata JSON string."""
    try:
        parsed = json.loads(metadata_str)
    except json.JSONDecodeError as error:
        print(f"Error: Invalid JSON in --metadata: {error}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(parsed, dict):
        print("Error: --metadata must be a JSON object", file=sys.stderr)
        sys.exit(1)

    return parsed


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
    metadata: Dict[str, Any],
) -> List[Dict[str, Any]] | List[List[Dict[str, Dict[str, str]]]]:
    """Build task payload for one task file in selected output format."""
    if args.output_format == "simple-label-maker":
        payload: List[Dict[str, Any]] = []

        for pos, sample_offset in enumerate(indices):
            sample_index = args.start_index + sample_offset
            sample_url = build_sample_url(
                base_url=args.base_url,
                sample_prefix=args.sample_prefix,
                sample_index=sample_index,
                sample_extension=args.sample_extension,
            )

            item = {
                "id": f"{args.id_prefix}_{sample_index}",
                "fileName": sample_url,
                "type": args.sample_type,
            }
            if metadata:
                item["metadata"] = metadata.copy()
            payload.append(item)

        return payload

    payload_ls: List[List[Dict[str, Dict[str, str]]]] = []

    for pos, sample_offset in enumerate(indices):
        sample_index = args.start_index + sample_offset
        sample_url = build_sample_url(
            base_url=args.base_url,
            sample_prefix=args.sample_prefix,
            sample_index=sample_index,
            sample_extension=args.sample_extension,
        )

        item = {
            "id": f"{args.id_prefix}_{sample_index}",
            "data": {
                args.data_field: sample_url,
            },
        }
        payload_ls.append([item])

    return payload_ls


def write_task_file(
    payload: List[Dict[str, Any]] | List[List[Dict[str, Dict[str, str]]]],
    file_path: str,
    indent: int,
) -> None:
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
    metadata = parse_metadata(args.metadata)

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
        f"reviewers_per_overlap={args.reviewers_per_overlap}, "
        f"format={args.output_format}, "
        f"metadata_fields={len(metadata)}"
    )

    total_entries = 0

    for task_index, indices in enumerate(assignments):
        payload = build_task_payload(
            indices=indices,
            task_index=task_index,
            args=args,
            metadata=metadata,
        )

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
