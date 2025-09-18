const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.status(200).send('Express server is healthy!');
});

app.get('/', (req, res) => {
  res.send('<h1>Minimal Express Server Running</h1>');
});

app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
});
