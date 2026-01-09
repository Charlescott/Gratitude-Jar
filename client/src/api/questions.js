export async function getRandomQuestion() {
  const res = await fetch("https://gratuity-jar-api.onrender.com/" + "api/questions/random");

  if (!res.ok) {
    throw new Error("Failed to fetch question");
  }

  return res.json();
}
