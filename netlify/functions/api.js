const serverless = require("serverless-http");
const app = require("../../server");

// Wrap the existing Express application for Netlify Functions (AWS Lambda)
const handler = serverless(app);

module.exports.handler = async (event, context) => {
  // In serverless functions, prevent timeouts due to background keep-alive connections
  context.callbackWaitsForEmptyEventLoop = false;
  return await handler(event, context);
};
