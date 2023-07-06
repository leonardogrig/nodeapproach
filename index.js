const dotenv = require("dotenv");
const natural = require("natural");
const { Configuration, OpenAIApi } = require("openai");
const getDocumentFromMongo = require("./getFromDb");
const { YoutubeTranscript } = require("youtube-transcript");
const { find_most_similar_text } = require("./utility");

dotenv.config();

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.openai_api_key,
  })
);

function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function main() {
  console.time("Response Time");
  const question = "vale a pena investir na vivara?";

  const fetchedMongoData = await getDocumentFromMongo(question);

  const fetchedTranscriptions = await Promise.all(
    fetchedMongoData.map((video) =>
      YoutubeTranscript.fetchTranscript(video._id)
    )
  );

  // // to consider all transcriptions found:
  //   const documents = fetchedTranscriptions
  //     .map((transcript) => transcript.map((segment) => segment.text).join(" "))
  //     .join(" ")
  //     .split(/\s+/);

  if (fetchedTranscriptions.length < 2) {
    throw new Error("Not enough transcriptions");
  }

  const documents = [fetchedTranscriptions[0], fetchedTranscriptions[1]]
    .map((segment) => segment.text)
    .join(" ")
    .split(/\s+/);

  const tfidf = new natural.TfIdf();
  documents.forEach((doc) => tfidf.addDocument(doc));

  const chapGPT = async (prompt) => {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that bases your opinion ONLY on what the author of the text says. You must ONLY respond according to this relevant text which are chunks of transcriptions from videos of the channel "Investidor Sardinha". The author of the video is "Raul Sena". The text and your answer will be in Portuguese (BR). Here is the text:\n${find_most_similar_text(
            tfidf,
            documents,
            prompt
          )}`,
        },
        { role: "user", content: prompt },
        {
          role: "system",
          content:
            "The response should be in Portuguese (BR) and only based on the text.",
        },
      ],
    });
    return response.data.choices[0].message.content;
  };

  const fetchedVideos = fetchedMongoData.map((video) => {
    return {
      videoId: video._id,
      title: toTitleCase(video.title.replace(/[^0-9a-z\u00C0-\u00FF ]/gi, "")),
      thumbnail: video.thumbnail.url,
      score: video.score,
    };
  });

  const responseObj = {
    response: await chapGPT(question),
    fetchedVideos: fetchedVideos.slice(0, 5),
  };

  console.log(responseObj);
  console.timeEnd("Response Time");
  return responseObj;
}

main();
