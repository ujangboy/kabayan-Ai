import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sources.youtube_source import YoutubeSource

def test_youtube_source():
    # Example video: Let's use a standard test video with CC, 
    # e.g., standard "Hello World" or anything. I'll just use a random popular short video id or just test the metadata fetch.
    url = "https://www.youtube.com/watch?v=jNQXAC9IVRw" # "Me at the zoo" - first youtube video
    
    source = YoutubeSource(url)
    print("Video ID:", source.video_id)
    
    meta = source.get_metadata()
    print("Metadata:", meta)
    
    try:
        chunks = source.extract()
        print(f"Extracted {len(chunks)} chunks.")
        if chunks:
            print("First chunk preview:")
            print(chunks[0].content[:100])
            print("Time start:", chunks[0].timestamp_start)
            print("Time end:", chunks[0].timestamp_end)
    except Exception as e:
        print("Transcript fetch failed (might not have CC):", e)

if __name__ == "__main__":
    test_youtube_source()
