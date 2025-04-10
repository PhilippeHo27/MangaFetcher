import json
import os
import sys

# Ensure the backend directory is in the Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.dirname(backend_dir)) # Add parent dir (project root) to path if needed

# Import the necessary function from MangaScraper
# We assume MangaScraper.py is in the same directory
try:
    from MangaScraper import add_manga, load_manga_sources
except ImportError as e:
    print(f"Error importing MangaScraper: {e}")
    print("Ensure MangaScraper.py is in the same directory or accessible via PYTHONPATH.")
    sys.exit(1)

# Define paths relative to the script location (backend)
data_dir = os.path.join(backend_dir, '..', 'docs', 'data')
pending_file_path = os.path.join(data_dir, 'pending_changes.json')

def process_pending_changes():
    """Reads pending changes, adds them as manga sources, and clears the pending file."""
    pending_changes = []
    processed_count = 0
    error_count = 0

    # Ensure data directory exists
    if not os.path.exists(data_dir):
        print(f"Data directory not found: {data_dir}")
        # Optionally create it: os.makedirs(data_dir)
        sys.exit(1)

    # Read pending changes
    if os.path.exists(pending_file_path) and os.path.getsize(pending_file_path) > 0:
        try:
            with open(pending_file_path, 'r') as f:
                pending_changes = json.load(f)
            if not isinstance(pending_changes, list):
                 print(f"Warning: {pending_file_path} does not contain a valid JSON list. Clearing it.")
                 pending_changes = []
        except json.JSONDecodeError:
            print(f"Error decoding JSON from {pending_file_path}. Clearing file.")
            pending_changes = [] # Clear if malformed
        except Exception as e:
            print(f"Error reading {pending_file_path}: {e}")
            # Decide if we should stop or continue with an empty list
            sys.exit(1) # Exit if we can't read the file
    else:
        print("No pending changes file found or file is empty. Nothing to process.")
        return # Nothing to do

    if not pending_changes:
         print("No changes listed in pending_changes.json.")
          # Clear the file even if it was empty or malformed to ensure clean state
         try:
             with open(pending_file_path, 'w') as f:
                 json.dump([], f)
             print(f"Cleared {pending_file_path}.")
         except Exception as e:
             print(f"Error clearing {pending_file_path}: {e}")
         return

    print(f"Found {len(pending_changes)} pending manga additions.")

    # Process each change
    for change in pending_changes:
        try:
            if isinstance(change, dict) and all(k in change for k in ('name', 'url', 'selector')):
                print(f"Processing addition: {change['name']}")
                # Call add_manga from MangaScraper
                add_manga(
                    name=change['name'],
                    url=change['url'],
                    selector=change['selector'],
                    use_xpath=change.get('use_xpath', False)
                )
                processed_count += 1
            else:
                 print(f"Skipping invalid change format: {change}")
                 error_count += 1
        except Exception as e:
            print(f"Error processing change {change.get('name', '(unknown)')}: {e}")
            error_count += 1

    # Clear the pending changes file only if there were no processing errors
    if error_count == 0:
        try:
            with open(pending_file_path, 'w') as f:
                json.dump([], f) # Write an empty list
            print(f"Successfully processed {processed_count} changes.")
            print(f"Cleared {pending_file_path}.")
        except Exception as e:
            print(f"Error clearing {pending_file_path} after processing: {e}")
            print("Please clear the file manually after verifying processed items.")
    else:
        print(f"Completed processing with {error_count} errors out of {len(pending_changes)} changes.")
        print(f"Successfully processed: {processed_count}")
        print(f"!!! {pending_file_path} was NOT cleared due to errors. Please review the file and logs. !!!")
        sys.exit(1) # Exit with error code if processing failed for some items

if __name__ == "__main__":
    process_pending_changes()
