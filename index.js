const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
// write the import functions first

const dbPath = path.join(__dirname, "goodreads.db");
const app = express();

app.use(express.json());

let db = null;

// Database & server Initialize

const initializeDBAndServer = async () => {
  try {
    // try/catch for exceptions
    db = await open({ filename: dbPath, driver: sqlite3.Database }); // db returns connection object from server to Database.
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

// Middleware function
// In middleware we are verifying jwtToken, if ok we are calling handler else sending error message invalid jwtToken

const authenticateToken = (request, response, next) => {
  // next will call another middleware if present, else calls handler
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        request.username = payload.username; // username key for profile API
        next(); // calls next middleware function if present else calls Handler
      }
    });
  }
};

// Get Profile API
app.get("/profile/", authenticateToken, async (request, response) => {
  let { username } = request; // username from middleware.check in middleware
  const selectUserQuery = `SELECT * FROM user WHERE username="${username}"`;
  const userDetails = await db.get(selectUserQuery);
  response.send(userDetails);
});

//Get Books API
app.get("/books/", authenticateToken, async (request, response) => {
  const getBooksQuery = `
            SELECT
              *
            FROM
             book
            ORDER BY
             book_id;`;
  const booksArray = await db.all(getBooksQuery); // db is connection object of server to database
  response.send(booksArray);
});

//Get Book API
// first path then middleware function(authenticateToken) then handler
app.get("/books/:bookId/", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const getBookQuery = `
      SELECT
       *
      FROM
       book 
      WHERE
       book_id = ${bookId};
    `;
  const book = await db.get(getBookQuery);
  response.send(book);
});

//User Register API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    await db.run(createUserQuery);
    response.send(`User created successfully`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//User Login API
// IN login API, we are sending username& password & response is jwTToken
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});
