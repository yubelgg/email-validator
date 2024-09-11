const http = require("http");
const https = require("https");
const fs = require("fs");
const querystring = require("querystring");

const port = 3000;

const { api_key, cat_api_key } = require("./auth/credentials.json");

const server = http.createServer();

server.on("listening", () => {
  console.log(`Listening on port ${port}`);
});
server.listen(port);

server.on("request", req_handler);

function req_handler(req, res) {
  if (req.url === "/") {
    const form = fs.createReadStream("index.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    form.pipe(res);
  } else if (req.url.startsWith("/validate")) {
    const user_input = new URL(req.url, `https://${req.headers.host}`)
      .searchParams;
    console.log(user_input);
    const email_input = user_input.get("email");
    if (email_input == null || email_input == "") {
      bad_request(res);
      return;
    }
    validator_api(email_input, res);
  } else if (req.url.startsWith("./images")) {
    const image_readstream = fs.createReadStream(`.${req.url}`);
    image_readstream.on("error", () => {
      bad_request(res);
    });
    image_readstream.on("ready", () => {
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      image_readstream.pipe(res);
    });
  }
}

function validator_api(email_input, res) {
  if (api_key == null || api_key == "") {
    key_error(res);
    return;
  }
  const email_query = querystring.stringify({
    key: api_key,
    email: email_input,
  });
  const email_endpoint = `https://api.mailboxvalidator.com/v2/validation/single?${email_query}`;
  const get_email = https.request(email_endpoint, { method: "GET" });

  get_email.on("response", (stream) => {
    console.log("API 1");
    process_stream(stream, parse_email, res);
  });
  get_email.end();
}

function process_stream(stream, callback, ...args) {
  let body = "";
  stream.on("data", (chunk) => (body += chunk));
  stream.on("end", () => callback(body, ...args));
}

function parse_email(body, res) {
  let email_object = JSON.parse(body);
  console.log(email_object);
  let { is_domain } = email_object;
  // checks if input is an email form
  if (is_domain == null || is_domain == false) {
    bad_request(res);
    return;
  }
  let { email_address, is_syntax, is_verified, status } = email_object;
  let syntax = is_syntax == true ? "a valid syntax" : "not a valid syntax";
  let verify = is_verified == true ? "verified" : "not verified";
  let valid = status == true ? "valid" : "not valid";
  let result = `<div><input type="button" onclick=location.href="http://localhost:3000/" value="home"/></div>`;
  result += `<div><h2>${email_address} is ${syntax} and is ${verify}, so the email address is <b>${valid}</b></h2></div>`;
  // calls the second API after the first one completes and writes to result
  cat_api(result, res);
}

function cat_api(result, res) {
  if (api_key == null || api_key == "") {
    key_error(res);
    return;
  }
  const cat_query = querystring.stringify({
    api_key: cat_api_key,
    has_breeds: 1,
  });
  const cat_endpoint = `https://api.thecatapi.com/v1/images/search?${cat_query}`;
  const get_cat = https.get(cat_endpoint);
  get_cat.on("response", (stream) => {
    console.log("API 2");
    process_stream(stream, parse_cat, result, res);
  });
}

function parse_cat(body, result, res) {
  let cat_object = JSON.parse(body);
  console.log(cat_object);
  let photo_url = cat_object[0]?.url;
  let name = cat_object[0]?.breeds[0]?.name;
  let age = cat_object[0]?.breeds[0]?.life_span;
  let description = cat_object[0]?.breeds[0]?.description;
  result += `<div><p>This cat breed is called ${name}.</p></div>`;
  result += `<div><p>${description}</p></div>`;
  result += `<div><p>This cat lives up to the age of ${age} years.</p></div>`;
  console.log(photo_url);
  let split_string = photo_url.split("/");
  let file_name = split_string[split_string.length - 1];
  console.log(file_name);
  let img_path = `./js/images/${file_name}`;
  // caching
  fs.access(img_path, fs.constants.F_OK, (err) => {
    if (err) {
      console.log("not cached");
      generate_photo(photo_url, img_path, result, res);
    } else {
      console.log("cached");
      result += `<img src="${img_path}" width="1280" height="720"/>`;
      res.end(result);
    }
  });
}

function generate_photo(photo_url, img_path, result, res) {
  const image_request = https.get(photo_url);
  image_request.on("response", function get_image(image_stream) {
    const save_image = fs.createWriteStream(img_path, { encoding: null });
    image_stream.pipe(save_image);
    save_image.on("finish", () => {
      result += `<img src="${img_path}" width="1280" height="720"/>`;
      res.end(result);
    });
  });
}

function bad_request(res) {
  res.writeHead(404, { "Content-Type": "text/html" });
  res.end(
    `<div><h1>404 bad request</h1><input type="button" onclick=location.href="http://localhost:3000/" value="home"/></div>`,
  );
}

function key_error(res) {
  res.writeHead(400, { "Content-Type": "text/html" });
  res.end(
    `<h1>400 error with provided API key </h1><input type="button" onclick="http://localhost:3000/" value="home"/>`,
  );
}
