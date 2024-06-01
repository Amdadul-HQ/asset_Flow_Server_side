require("dotenv").config();
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");
const app = express();

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster12.5dhxjyi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster12`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    const usersCollection = client.db("assetFlow").collection("users");
    const hrCollection = client.db("assetFlow").collection("Hr");

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "30d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // logout 
    app.get("/logout", async (req, res) => {
        try {
          res
            .clearCookie("token", {
              maxAge: 0,
              secure: process.env.NODE_ENV === "production",
              sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            })
            .send({ success: true });
        } catch (err) {
          res.status(500).send(err);
        }
      });

    // save a hr in data base
    app.put('/hrmanager',async(req,res)=> {
      const hr = req.body;
      const option = {upsert:true};
      const query = {
        email:hr?.email
      }
      const isExist = await hrCollection.findOne(query)
      if(isExist){
        return isExist
      }
      else{
        const result = await hrCollection.insertOne(hr)
        res.send(result)
      }
    })

    // save a user in data base
    app.put("/user", async (req, res) => {
      const user = req.body;
      const option = { upsert: true };
      const query = {
        email: user?.email,
      };
      // Checking isExeist
      const isExist = await usersCollection.findOne(query);
      if(isExist){
        return isExist
      }
      else{
        const result = await usersCollection.insertOne(user)
        res.send(result)
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.use("/", (req, res) => {
  res.send("server is running");
});
app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
