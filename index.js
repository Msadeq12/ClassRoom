const express = require("express");
const Mongo = require("mongoose");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const { urlencoded } = require("body-parser");
const {check, validationResult} = require("express-validator");

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
    res.render("signup");
});

Website.get('/login', (req, res) =>{
    res.render('login')
});

Website.get('/signup', (req, res) => {
    res.render('signup');
});


//handing post requests from the signup page.
Website.post('/signup', [
    check("firstname", "must have a first name !").not().isEmpty(),
    check("lastname", "must have a last name !").not().isEmpty(),
    check("Email", "must have an email !").isEmail(),
    check("Password", "must have a password").not().isEmpty()
], (req,res) => {
    var errors = validationResult(req);
    var email = req.body.Email;
    var password = req.body.Password;
    var confirmPassword = req.body.confirmPassword;

    if (!errors.isEmpty())
    {
        res.render("signup", {
            errors:errors.array()
        });

        return;
    }

    else 
    {
        res.render("home");
    }
      
});

Website.post('/login', (req, res) => {
    console.log(req.body);
    
});

Website.listen(1550, () => {
    console.log("Listening at 1550...");
});
