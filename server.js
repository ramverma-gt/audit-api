const express = require("express");
const { config } = require("dotenv");
const mongoose = require("mongoose");
const multer = require("multer");
const {
  GridFsStorage
} = require("multer-gridfs-storage");
const bodyParser = require('body-parser')

config({path: ".env"})

const log = console.log;

const app = express()

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
  extended: true
}));

// parse application/json
app.use(bodyParser.json())

const mongouri = `mongodb+srv://oropocket:${process.env.MONGO_PASS}@cluster0.imgwz.mongodb.net/${process.env.DATABASE}?retryWrites=true&w=majority`;

try {
  mongoose.connect(mongouri, {
    useUnifiedTopology: true,
    useNewUrlParser: true
  });
} catch (error) {
  handleError(error);
}
process.on('unhandledRejection', error => {
  log('unhandledRejection', error.message);
});

//creating bucket
let bucket;
let dbo;
mongoose.connection.on("connected", () => {
  var client = mongoose.connections[0].client;
  var db = mongoose.connections[0].db;
  dbo = client.db("audit");
  bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: "newBucket"
  });
});

// app.use(express.json());
// app.use(express.urlencoded({
//   extended: false
// }));

const storage = new GridFsStorage({
  url: mongouri,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = file.originalname;
      const fileInfo = {
        filename: 'audit-report-'.concat(filename),
        bucketName: "newBucket"
      };
      resolve(fileInfo);
    });
  }
});

app.get("/audit-report/:filename", (req, res) => {
  bucket
    .find({
      filename: 'audit-report-'.concat(req.params.filename).concat('.pdf')
    })
    .toArray((err, files) => {
      if (!files || files.length === 0) {
        return res.status(404)
          .json({
            err: "no files exist"
          });
      }
      bucket.openDownloadStreamByName('audit-report-'.concat(req.params.filename).concat('.pdf'))
        .pipe(res);
    });
});

const upload = multer({
  storage
});

// get audit report
app.get('/get-audit-data/:tokenName', (req, res) => {
  try {
    dbo.collection("audit-data").findOne({tokenName: req.params.tokenName}, (err, result) => {
      res.status(200).json({
        "status": 200,
        "message": "audit data",
        "data": {
          result,
          auditReport: `http://localhost:${process.env.PORT}/audit-report/${req.params.tokenName}`
        }
      })
    })
  } catch (err) {
    res.status(500).json({
      "status": 500,
      "message": err.message,
    })
  }
})

app.post('/add-audit-data/', (req, res) => {
  let dataObject = {
    "tokenName": req.body.tokenName,
    "owner": req.body.owner,
    "url": req.body.url,
    "ticker": req.body.ticker,
    "totalSupply": req.body.totalSupply,
    "rate-by-unifarm": req.body.rate,
    "audit-type": req.body.auditType,
  }

  try {
    dbo.collection("audit-data").insertOne(dataObject, (err) => {
      if (err) console.log(err);
      res.status(200).json({
        "status": 200,
        "message": "audit data submitted"
      })
    })
  } catch (err) {
    res.status(500).json({
      "status": 500,
      "message": err.message
    })
  }
})

// upload audit report
app.post('/upload-audit-report/', upload.single("file"), (req, res) => {
  res.status(200).json({
    "status": 200,
    "message": "file uploaded successfully",
    "data": {}
  })
});

app.listen(process.env.PORT, () => {
  log(`tvl server started at ${process.env.PORT} port.`);
});