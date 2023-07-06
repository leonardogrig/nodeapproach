const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");

dotenv.config();

const client = new MongoClient(process.env.mongo_url, {
  useUnifiedTopology: true,
});

let isDBInitialized = false;

const initializeDb = async () => {
  try {
    await client.connect();
    const collection = client
      .db("vectorDbTest")
      .collection("vectorCollectionTest");

    await collection.dropIndexes();
    await collection.createIndex(
      { title: "text", description: "text" },
      { default_language: "portuguese" }
    );

    isDBInitialized = true;
  } catch (err) {
    console.error(err);
    await client.close();
  }
};

const getDocumentFromMongo = async (question) => {
  if (!isDBInitialized) {
    await initializeDb();
  }

  try {
    const collection = client
      .db("vectorDbTest")
      .collection("vectorCollectionTest");

    const query = { $text: { $search: question } };
    const projection = {
      score: { $meta: "textScore" },
      _id: 1,
      thumbnail: 1,
      title: 1,
    };

    let results = await collection
      .find(query, { projection })
      .sort({ score: { $meta: "textScore" } })
      .limit(10)
      .toArray();

    if (!results || results.length === 0) {
      console.error("No results found");
      return [];
    }

    const totalScore = results.reduce((total, doc) => total + doc.score, 0);
    results.forEach((doc) => {
      doc.score = (doc.score / totalScore) * 100;
    });

    results = results.filter((doc) => doc.score >= 10);
    return results;
  } catch (err) {
    console.error(err);
    return [];
  }
};

initializeDb();

module.exports = getDocumentFromMongo;
