#!/usr/bin/env python3
"""
Migration script to convert Label Studio task files to Simple Label Maker format.

Usage:
    python migrate_from_label_studio.py --task task.json --type time-series --metadata '{"channelCount": 10}' --output samples.json
"""

import json
import argparse
import sys
from typing import List, Dict, Any


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Convert Label Studio task file to Simple Label Maker format'
    )
    parser.add_argument(
        '--task',
        required=True,
        help='Path to the Label Studio task JSON file'
    )
    parser.add_argument(
        '--type',
        required=True,
        choices=['image', 'text', 'audio', 'video', 'time-series'],
        help='Sample type for all samples'
    )
    parser.add_argument(
        '--metadata',
        default='{}',
        help='JSON string of metadata to apply to all samples (e.g., \'{"channelCount": 10}\')'
    )
    parser.add_argument(
        '--output',
        default='samples.json',
        help='Output file path (default: samples.json)'
    )
    parser.add_argument(
        '--data-field',
        default=None,
        help='Specific data field to extract (e.g., "csv_url"). If not specified, uses first data field found.'
    )
    
    return parser.parse_args()


def load_label_studio_tasks(task_file: str) -> List[Dict[str, Any]]:
    """Load and parse Label Studio task file."""
    try:
        with open(task_file, 'r') as f:
            tasks = json.load(f)
        
        # Flatten if tasks are wrapped in arrays (as in the example)
        flattened_tasks = []
        for task in tasks:
            if isinstance(task, list):
                flattened_tasks.extend(task)
            else:
                flattened_tasks.append(task)
        
        return flattened_tasks
    except FileNotFoundError:
        print(f"Error: Task file '{task_file}' not found", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in task file: {e}", file=sys.stderr)
        sys.exit(1)


def parse_metadata(metadata_str: str) -> Dict[str, Any]:
    """Parse metadata JSON string."""
    try:
        return json.loads(metadata_str)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in metadata: {e}", file=sys.stderr)
        sys.exit(1)


def extract_data_url(task: Dict[str, Any], data_field: str = None) -> str:
    """Extract the data URL from a Label Studio task."""
    data = task.get('data', {})
    
    if not data:
        raise ValueError(f"Task {task.get('id', 'unknown')} has no 'data' field")
    
    # If specific field is requested, use it
    if data_field:
        if data_field not in data:
            raise ValueError(f"Task {task.get('id', 'unknown')} does not have data field '{data_field}'")
        return data[data_field]
    
    # Otherwise, use the first field found
    data_keys = list(data.keys())
    if not data_keys:
        raise ValueError(f"Task {task.get('id', 'unknown')} has empty 'data' object")
    
    return data[data_keys[0]]


def convert_tasks_to_samples(
    tasks: List[Dict[str, Any]], 
    sample_type: str, 
    metadata: Dict[str, Any],
    data_field: str = None
) -> List[Dict[str, Any]]:
    """Convert Label Studio tasks to Simple Label Maker sample format."""
    samples = []
    
    for task in tasks:
        try:
            task_id = task.get('id', f'task_{len(samples)}')
            data_url = extract_data_url(task, data_field)
            
            sample = {
                'id': task_id,
                'fileName': data_url,
                'type': sample_type
            }
            
            # Add metadata if provided
            if metadata:
                sample['metadata'] = metadata.copy()
            
            samples.append(sample)
            
        except ValueError as e:
            print(f"Warning: Skipping task - {e}", file=sys.stderr)
            continue
    
    return samples


def save_samples(samples: List[Dict[str, Any]], output_file: str):
    """Save samples to JSON file."""
    try:
        with open(output_file, 'w') as f:
            json.dump(samples, f, indent=2)
        print(f"Successfully converted {len(samples)} tasks to '{output_file}'")
    except IOError as e:
        print(f"Error: Failed to write output file: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    """Main execution function."""
    args = parse_arguments()
    
    print(f"Loading Label Studio tasks from '{args.task}'...")
    tasks = load_label_studio_tasks(args.task)
    print(f"Loaded {len(tasks)} tasks")
    
    print(f"Parsing metadata...")
    metadata = parse_metadata(args.metadata)
    
    print(f"Converting tasks to samples (type: {args.type})...")
    samples = convert_tasks_to_samples(tasks, args.type, metadata, args.data_field)
    
    if not samples:
        print("Error: No valid samples were converted", file=sys.stderr)
        sys.exit(1)
    
    print(f"Saving {len(samples)} samples to '{args.output}'...")
    save_samples(samples, args.output)
    
    print("\nConversion complete!")
    print(f"\nTo use these samples, update your project.json:")
    print(f'  "sampleTask": {{')
    print(f'    "fileName": "{args.output}"')
    print(f'  }}')


if __name__ == '__main__':
    main()
