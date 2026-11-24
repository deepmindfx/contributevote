export default function handler(_request: unknown, response: { status: (code: number) => { json: (body: { error: string }) => void } }) {
  response.status(410).json({ error: "This diagnostic endpoint was retired." });
}
