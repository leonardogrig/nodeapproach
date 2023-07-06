function get_similar_texts_indices(tfidf, documents, question) {
  return documents
    .map((doc, index) => ({
      index,
      similarity: tfidf.tfidf(question, index),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map((similarity) => similarity.index);
}

function extract_chunk(idx, texts, direction) {
  const start = direction === "previous" ? Math.max(0, idx - 200) : idx + 1;
  const end = direction === "next" ? Math.min(texts.length, idx + 200) : idx;
  return texts.slice(start, end).join(" ");
}

function find_most_similar_text(tfidf, documents, question) {
  return get_similar_texts_indices(tfidf, documents, question)
    .map((idx) => {
      return (
        extract_chunk(idx, documents, "previous") +
        documents[idx] +
        extract_chunk(idx, documents, "next")
      );
    })
    .join("\n\n");
}

module.exports = {
  get_similar_texts_indices,
  extract_chunk,
  find_most_similar_text,
};
