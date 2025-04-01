import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import argparse
import os
from lxml import etree
from urllib.parse import urljoin

# Create data directory if it doesn't exist
data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
os.makedirs(data_dir, exist_ok=True)

def load_manga_sources(filename='manga_sources.json'):
    filepath = os.path.join(data_dir, filename)
    # Create empty file if it doesn't exist
    if not os.path.exists(filepath):
        with open(filepath, 'w') as f:
            f.write('[]')  # Write valid empty JSON array
    
    with open(filepath, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            print(f"Error loading {filename}. Creating a new empty file.")
            with open(filepath, 'w') as f:
                f.write('[]')
            return []

def save_manga_chapters(chapters, filename='manga_chapters.json'):
    filepath = os.path.join(data_dir, filename)
    # Ensure the directory exists before writing
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w') as f:
        json.dump(chapters, f, indent=2)

def scrape_manga(url, selector, use_xpath=False):
    """
    Scrapes the manga page for the latest chapter text and its URL.
    Returns a dictionary {'text': chapter_text, 'url': chapter_url, 'scrapedAt': timestamp} or default values.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    now_iso = datetime.now().isoformat()
    default_result = {"text": "Unknown", "url": None, "scrapedAt": now_iso}
    try:
        response = requests.get(url, headers=headers, timeout=15) # Added timeout
        response.raise_for_status()

        chapter_text = "Unknown"
        chapter_url = None

        if use_xpath:
            # Using lxml parser for XPath support
            # Need to parse the response content directly with lxml for better XPath handling
            html_parser = etree.HTMLParser()
            tree = etree.fromstring(response.content, html_parser)
            elements = tree.xpath(selector)
            if elements:
                # Assuming the first element found contains the chapter text
                # Attempt to get text content robustly
                chapter_text = ''.join(elements[0].itertext()).strip()

                # Try to find the closest ancestor 'a' tag for the URL
                current_element = elements[0]
                while current_element is not None:
                    if current_element.tag == 'a' and 'href' in current_element.attrib:
                        chapter_url = current_element.get('href')
                        # Make URL absolute if it's relative
                        if chapter_url and not chapter_url.startswith(('http://', 'https://')):
                            chapter_url = urljoin(url, chapter_url)
                        break
                    current_element = current_element.getparent()

                return {"text": chapter_text, "url": chapter_url, "scrapedAt": now_iso}
            else:
                print(f"Warning: XPath '{selector}' not found on {url}")
                return default_result
        else:
            # Using CSS selector with BeautifulSoup
            soup = BeautifulSoup(response.text, 'html.parser') # Use html.parser as default
            element = soup.select_one(selector)
            if element:
                chapter_text = element.text.strip()
                # Try to find the closest 'a' tag parent for the URL
                anchor_tag = element.find_parent('a')
                if anchor_tag and anchor_tag.has_attr('href'):
                    chapter_url = anchor_tag['href']
                    # Make URL absolute if it's relative
                    if chapter_url and not chapter_url.startswith(('http://', 'https://')):
                         chapter_url = urljoin(url, chapter_url)

                return {"text": chapter_text, "url": chapter_url, "scrapedAt": now_iso}
            else:
                print(f"Warning: Selector '{selector}' not found on {url}")
                return default_result

    except requests.exceptions.RequestException as e: # Catch more specific exceptions
        print(f"Error scraping {url}: {e}")
        return {"text": "Error", "url": None, "scrapedAt": now_iso} # Return error with timestamp
    except Exception as e:
        print(f"An unexpected error occurred while scraping {url}: {e}")
        # Optionally log the full traceback here for debugging
        # import traceback
        # traceback.print_exc()
        return default_result


def update_manga_chapters():
    sources = load_manga_sources()
    
    # Try to load existing chapters data
    existing_chapters_data = []
    try:
        chapters_file = os.path.join(data_dir, 'manga_chapters.json')
        if os.path.exists(chapters_file) and os.path.getsize(chapters_file) > 0: # Check if file exists and is not empty
            with open(chapters_file, 'r') as f:
                try:
                    existing_chapters_data = json.load(f)
                    # Validate data structure slightly
                    if not isinstance(existing_chapters_data, list):
                        print(f"Warning: {chapters_file} does not contain a JSON list. Resetting.")
                        existing_chapters_data = []
                except json.JSONDecodeError:
                    print(f"Error decoding JSON from {chapters_file}. Starting fresh.")
                    existing_chapters_data = []
        else:
            # Create manga_chapters.json if it doesn't exist or is empty
            if not os.path.exists(chapters_file) or os.path.getsize(chapters_file) == 0:
                 with open(chapters_file, 'w') as f:
                    f.write('[]') # Initialize with empty JSON array
            existing_chapters_data = []
    except Exception as e: # Catch potential errors during file loading
        print(f"Error loading existing chapters data: {e}. Starting fresh.")
        existing_chapters_data = []

    # Create lookup for existing data by manga ID
    existing_lookup = {manga_data['id']: manga_data for manga_data in existing_chapters_data if isinstance(manga_data, dict) and 'id' in manga_data}

    updated_chapters_data = []
    three_weeks_ago = datetime.now() - timedelta(weeks=3)

    for source in sources:
        # Ensure source is a dictionary and has necessary keys
        if isinstance(source, dict) and 'id' in source and 'name' in source and 'url' in source and 'selector' in source:
            manga_id = source['id']
            if source.get('isActive', True):
                print(f"Scraping {source['name']} from {source['url']}...")
                scraped_chapter_info = scrape_manga(source['url'], source['selector'], source.get('use_xpath', False))

                # Get existing data for this manga, or create a new entry
                current_manga_data = existing_lookup.get(manga_id, {
                    'id': manga_id,
                    'title': source['name'],
                    'sourceUrl': source['url'],
                    'chapters': [],
                    'isRead': False,
                    'lastUpdated': datetime.now().isoformat()
                })

                # Update basic info from source (in case name/url changed)
                current_manga_data['title'] = source['name']
                current_manga_data['sourceUrl'] = source['url']
                current_manga_data['lastUpdated'] = datetime.now().isoformat()

                # Ensure 'chapters' list exists and is a list
                if not isinstance(current_manga_data.get('chapters'), list):
                     current_manga_data['chapters'] = []

                existing_chapters_list = current_manga_data['chapters']
                is_new_chapter = True

                # Check if the scraped chapter is already the latest one we have stored
                if existing_chapters_list:
                    latest_stored_chapter = existing_chapters_list[-1] # Get the last appended chapter
                    # Compare based on URL if available, otherwise text (handle None URLs)
                    if scraped_chapter_info['url'] and latest_stored_chapter.get('url') == scraped_chapter_info['url']:
                        is_new_chapter = False
                    elif not scraped_chapter_info['url'] and scraped_chapter_info['text'] != "Error" and scraped_chapter_info['text'] != "Unknown" and latest_stored_chapter.get('text') == scraped_chapter_info['text']:
                        is_new_chapter = False

                # Add the chapter if it's new and not an error/unknown
                if is_new_chapter and scraped_chapter_info['text'] not in ("Error", "Unknown"):
                    print(f"  -> New chapter found for {source['name']}: {scraped_chapter_info['text']}")
                    existing_chapters_list.append(scraped_chapter_info) # Append the new chapter info
                    current_manga_data['isRead'] = False # New chapter means it's unread
                elif scraped_chapter_info['text'] in ("Error", "Unknown"):
                     print(f"  -> Scrape result for {source['name']} was '{scraped_chapter_info['text']}'. No chapter added.")
                else:
                     print(f"  -> Chapter for {source['name']} hasn't changed.")

                 # Pruning: If manga is unread, remove chapters older than 3 weeks, keeping at least the latest one
                if not current_manga_data['isRead'] and len(existing_chapters_list) > 1:
                    chapters_to_keep = []
                    # Always keep the latest chapter
                    latest_chap = existing_chapters_list[-1]
                    chapters_to_keep.append(latest_chap)
                    # Check older chapters
                    for chap in reversed(existing_chapters_list[:-1]): # Iterate from second-latest backwards
                        try:
                            scraped_time = datetime.fromisoformat(chap['scrapedAt'])
                            if scraped_time >= three_weeks_ago:
                                chapters_to_keep.insert(0, chap) # Add back if recent
                        except (ValueError, TypeError):
                             print(f"  -> Warning: Invalid date format '{chap.get('scrapedAt')}' for chapter '{chap.get('text')}'. Keeping it.")
                             chapters_to_keep.insert(0, chap) # Keep if date is invalid
                    
                    if len(chapters_to_keep) < len(existing_chapters_list):
                        print(f"  -> Pruning old chapters for {source['name']}. Kept {len(chapters_to_keep)} chapters.")
                        current_manga_data['chapters'] = chapters_to_keep

                updated_chapters_data.append(current_manga_data)
            else:
                # If source is inactive, but we have data for it, keep the existing data
                if manga_id in existing_lookup:
                    updated_chapters_data.append(existing_lookup[manga_id])

    # Add back any existing manga data that wasn't in the current sources (e.g., if source was deleted but data remains)
    existing_ids = {m['id'] for m in updated_chapters_data}
    for manga_id, manga_data in existing_lookup.items():
        if manga_id not in existing_ids:
             updated_chapters_data.append(manga_data)

    save_manga_chapters(updated_chapters_data)
    return updated_chapters_data

def add_manga(name, url, selector, use_xpath=False):
    sources = load_manga_sources()
    new_id = max([manga.get('id', 0) for manga in sources], default=0) + 1
    sources.append({
        'id': new_id,
        'name': name,
        'url': url,
        'selector': selector,
        'use_xpath': use_xpath,
        'isActive': True
    })
    
    sources_filepath = os.path.join(data_dir, 'manga_sources.json')
    with open(sources_filepath, 'w') as f:
        json.dump(sources, f, indent=2)
    print(f"Added manga source: {name} (ID: {new_id})")

    # Also add a basic entry to manga_chapters.json immediately
    chapters_file = os.path.join(data_dir, 'manga_chapters.json')
    all_manga_data = []
    if os.path.exists(chapters_file) and os.path.getsize(chapters_file) > 0:
        try:
            with open(chapters_file, 'r') as f:
                all_manga_data = json.load(f)
            if not isinstance(all_manga_data, list):
                 all_manga_data = []
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not read or parse {chapters_file} before adding new entry: {e}")
            all_manga_data = []

    # Check if manga ID already exists (shouldn't, but good practice)
    if not any(m.get('id') == new_id for m in all_manga_data if isinstance(m, dict)):
        all_manga_data.append({
            'id': new_id,
            'title': name,
            'sourceUrl': url,
            'chapters': [], # Start with empty chapters list
            'isRead': False,
            'lastUpdated': datetime.now().isoformat(),
             # Add a status field for the UI?
            'status': 'Pending First Scrape' # Indicates it hasn't been scraped yet
        })
        save_manga_chapters(all_manga_data)
        print(f"Added pending entry for {name} (ID: {new_id}) to chapters data.")

    return new_id # Return the ID of the newly added manga

def mark_manga_read(manga_id, is_read=True):
    """Marks a specific manga as read or unread in manga_chapters.json.
       If marking as read, it also clears out all but the most recent chapter."""
    chapters_file = os.path.join(data_dir, 'manga_chapters.json')
    chapters = []
    try:
        if os.path.exists(chapters_file) and os.path.getsize(chapters_file) > 0:
            with open(chapters_file, 'r') as f:
                chapters = json.load(f)
        else:
             print(f"Warning: {chapters_file} not found or empty. Cannot mark as read.")
             return False # Indicate failure

    except json.JSONDecodeError:
        print(f"Error decoding JSON from {chapters_file}. Cannot mark as read.")
        return False # Indicate failure
    except Exception as e:
        print(f"Error loading {chapters_file}: {e}")
        return False # Indicate failure

    updated = False
    for manga_data in chapters:
         # Ensure manga_data is a dictionary and has an 'id' key
         if isinstance(manga_data, dict) and manga_data.get('id') == manga_id:
            manga_data['isRead'] = is_read
            print(f"Marked manga ID {manga_id} as {'read' if is_read else 'unread'}.")

            # If marking as read and chapters list exists and has more than one entry, prune it
            if is_read and isinstance(manga_data.get('chapters'), list) and len(manga_data['chapters']) > 1:
                latest_chapter = manga_data['chapters'][-1]
                manga_data['chapters'] = [latest_chapter]
                print(f"  -> Cleared older chapters for manga ID {manga_id}, kept the latest.")

            updated = True
            break # Assuming unique IDs

    if updated:
        save_manga_chapters(chapters)
        return True # Indicate success
    else:
        print(f"Manga ID {manga_id} not found in chapters data.")
        return False # Indicate failure

def clear_manga_chapters(manga_id):
    """Removes all but the latest chapter for a given manga ID."""
    chapters_file = os.path.join(data_dir, 'manga_chapters.json')
    all_manga_data = []
    try:
        if os.path.exists(chapters_file) and os.path.getsize(chapters_file) > 0:
            with open(chapters_file, 'r') as f:
                all_manga_data = json.load(f)
        else:
             print(f"Warning: {chapters_file} not found or empty. Cannot clear chapters.")
             return False # Indicate failure

    except json.JSONDecodeError:
        print(f"Error decoding JSON from {chapters_file}. Cannot clear chapters.")
        return False # Indicate failure
    except Exception as e:
        print(f"Error loading {chapters_file}: {e}")
        return False # Indicate failure

    updated = False
    cleared_count = 0
    for manga_data in all_manga_data:
         if isinstance(manga_data, dict) and manga_data.get('id') == manga_id:
             if isinstance(manga_data.get('chapters'), list) and len(manga_data['chapters']) > 1:
                 latest_chapter = manga_data['chapters'][-1]
                 cleared_count = len(manga_data['chapters']) - 1
                 manga_data['chapters'] = [latest_chapter]
                 updated = True
                 break
             elif isinstance(manga_data.get('chapters'), list) and len(manga_data['chapters']) <= 1:
                 print(f"Manga ID {manga_id} already has only one or zero chapters. Nothing to clear.")
                 return True # Indicate success (nothing needed to be done)
             else:
                 print(f"Manga ID {manga_id} found, but has no valid chapter list.")
                 return False # Indicate failure

    if updated:
        save_manga_chapters(all_manga_data)
        print(f"Cleared {cleared_count} older chapters for manga ID {manga_id}. Kept the latest.")
        return True
    elif cleared_count == 0 and not updated:
         # Handle case where the loop finished without finding the ID
         print(f"Manga ID {manga_id} not found in chapters data.")
         return False
    else:
         # Should ideally not be reached if ID was found
         print(f"Manga ID {manga_id} not found or no chapters to clear.")
         return False

def list_manga():
    sources = load_manga_sources()
    if not sources:
        print("No manga added yet. Use 'add' command to add some.")
        return
    
    print("\nYour Manga List:")
    print("-" * 50)
    for manga in sources:
        status = "Active" if manga.get('isActive', True) else "Inactive"
        xpath_status = "XPath" if manga.get('use_xpath', False) else "CSS Selector"
        print(f"ID: {manga.get('id')}, Name: {manga['name']}, Status: {status}")
        print(f"URL: {manga['url']}")
        print(f"Selector ({xpath_status}): {manga['selector']}")
        print("-" * 50)

def test_selector(url, selector, use_xpath=False):
    print(f"Testing {'XPath' if use_xpath else 'CSS Selector'} '{selector}' on {url}")
    result = scrape_manga(url, selector, use_xpath)
    print(f"Result: {result}")
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manga Chapter Tracker")
    subparsers = parser.add_subparsers(dest='action', help='Available actions', required=True)

    # Update action
    parser_update = subparsers.add_parser('update', help='Update all active manga chapters')

    # Add action
    parser_add = subparsers.add_parser('add', help='Add a new manga source')
    parser_add.add_argument('--name', required=True, help="Manga name")
    parser_add.add_argument('--url', required=True, help="Manga URL (main page)")
    parser_add.add_argument('--selector', required=True, help="CSS selector or XPath for latest chapter link/text")
    parser_add.add_argument('--xpath', action='store_true', help="Use XPath instead of CSS selector")

    # Remove action
    parser_remove = subparsers.add_parser('remove', help='Remove a manga source by ID')
    parser_remove.add_argument('--id', type=int, required=True, help="Manga ID")

    # List action
    parser_list = subparsers.add_parser('list', help='List all added manga sources')

    # Test action
    parser_test = subparsers.add_parser('test', help='Test a selector on a URL')
    parser_test.add_argument('--url', required=True, help="Manga URL to test")
    parser_test.add_argument('--selector', required=True, help="CSS selector or XPath to test")
    parser_test.add_argument('--xpath', action='store_true', help="Use XPath instead of CSS selector")

     # Mark Read/Unread action
    parser_mark = subparsers.add_parser('mark', help='Mark a manga as read or unread')
    parser_mark.add_argument('--id', type=int, required=True, help="Manga ID to mark")
    parser_mark.add_argument('--unread', action='store_true', help="Mark as unread instead of read")

    # Clear Chapters action
    parser_clear = subparsers.add_parser('clear', help='Clear all but the latest chapter for a manga')
    parser_clear.add_argument('--id', type=int, required=True, help="Manga ID to clear chapters for")

    args = parser.parse_args()

    if args.action == 'update':
        chapters = update_manga_chapters()
        if chapters: # Check if update returned anything
             print(f"\nUpdate complete. Checked {len(chapters)} active manga.")
        else:
             print("\nUpdate process finished.") # Handle case where sources might be empty
    elif args.action == 'add':
        add_manga(args.name, args.url, args.selector, args.xpath)
    elif args.action == 'remove':
        remove_manga(args.id)
    elif args.action == 'list':
        list_manga()
    elif args.action == 'test':
        test_selector(args.url, args.selector, args.xpath)
    elif args.action == 'mark':
         mark_manga_read(args.id, not args.unread) # Pass False if --unread is specified
    elif args.action == 'clear':
         clear_manga_chapters(args.id)
