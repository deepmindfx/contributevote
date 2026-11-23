exports.handler = async () => ({
  statusCode: 410,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ success: false, message: "Use the verified Supabase payment webhook." }),
});
