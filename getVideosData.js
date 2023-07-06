const request = require("superagent");
const dotenv = require("dotenv");
const MongoClient = require('mongodb').MongoClient;

dotenv.config();

let getVideoDetails = async (videoId, apiKey) => {
  const response = await request
    .get("https://www.googleapis.com/youtube/v3/videos")
    .query({ id: videoId })
    .query({ key: apiKey })
    .query({ part: "snippet" });

  let video = response.body.items[0];
  return {
    title: video.snippet.title,
    description: video.snippet.description,
    publishedAt: video.snippet.publishedAt,
    thumbnail: video.snippet.thumbnails.default,
    videoId: video.id,
  };
};

let getChannelVideos = async (channelId, apiKey) => {
  const response = await request
    .get("https://www.googleapis.com/youtube/v3/search")
    .query({ channelId: channelId })
    .query({ key: apiKey })
    .query({ part: "snippet" })
    .query({ order: "date" })
    .query({ maxResults: 50 });

  // Get complete video details for each video
  let videos = await Promise.all(
    response.body.items.map((item) => getVideoDetails(item.id.videoId, apiKey))
  );

  return videos;
};

async function saveToMongo(videos) {
  const url = process.env.mongo_url; // Connection URL to your MongoDB instance
  const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

  let session;

  try {
    await client.connect();

    session = client.startSession();
    session.startTransaction(); // Start transaction

    const collection = client.db('vectorDbTest').collection('vectorCollectionTest'); // Select your DB and collection

    const channelId = "UCM3vJxmuJJkk1r0yzFI9eZg"; // Use your channelId

    // Save each video as a separate document
    for(let video of videos) {
        video.channelId = channelId; // Add channelId to video document
        await collection.updateOne({ _id: video.videoId }, { $set: video }, { upsert: true, session });
    }

    await session.commitTransaction(); // Commit the transaction
  } catch (error) {
    console.error('Error occurred while saving to MongoDB:', error);
    if (session) {
      session.abortTransaction(); // Abort the transaction
    }
  } finally {
    if (session) {
      session.endSession();
    }
    await client.close();
  }
}

getChannelVideos("UCM3vJxmuJJkk1r0yzFI9eZg", process.env.google_api_key)
  .then((videos) => {
    return saveToMongo(videos);
  })
  .catch((err) => console.error(err));
