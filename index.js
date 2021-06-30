const express = require("express");
const Mongo = require("mongoose");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const { urlencoded } = require("body-parser");


const Website = express();
Website.use(bodyParser.urlencoded({extended: false}));
Website.use(express.static("public"));

Website.set("views", "pages");
Website.set("view engine", "ejs");

Mongo.connect("mongodb://localhost:27017/ClassRoom",
    {useNewUrlParser: true},
    () => console.log("connected to ClassRoom DB...")
);

Website.get("/", (req,res) => {
    res.render("home");
});

Website.get('/login', (req, res) =>{
    res.render('login')
});

//handing post requests

Website.post('/', (req, res) => {
    console.log(req.body);
});

Website.listen(1550, () => {
    console.log("Listening at 1550...");
})
