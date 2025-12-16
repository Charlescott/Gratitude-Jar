import { useState } from "react";
import { getRandomQuestion } from "../api/questions";

export default function Home() {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleGetQuestion() {
    setLoading(true);
    setError(null);

    try {
      const data = await getRandomQuestion();
      setQuestion(data);
    } catch (err) {
      setError("Could not load question");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Gratuity Jar</h1>

      <button onClick={handleGetQuestion}>Help me out</button>

      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}

      {question && <p>{question.text}</p>}
    </div>
  );
}
