const express = require("express");
const Mongo = require("mongoose");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const { urlencoded } = require("body-parser");
const {check, validationResult} = require("express-validator");
const cookieParser = require('cookie-parser');
const session = require("express-session");
const { exec } = require("child_process");


const Website = express();
Website.use(bodyParser.urlencoded({extended: false}));
Website.use(cookieParser());
Website.use(express.static("public"));

Website.set("views", "pages");
Website.set("view engine", "ejs");

Mongo.connect("mongodb://localhost:27017/ClassRoom",
    {useNewUrlParser: true},
    () => console.log("connected to ClassRoom DB...")
);

const User = Mongo.model("user",
    {
        email: String,
        password: String,
        salt: String,
        name: String,
        sessionid: String
    }
);

Website.get("/", (req,res) => {

    const sessionid =  req.cookies.SESSION_ID;
    

    User.findOne({sessionid: sessionid}).exec((err, user) => {
        if(err || user === null){
            res.render('login');
            console.log(user);
        }
        else{
            res.render("home");
        }
    });

});

Website.get('/signup', (req, res) => {
    res.render('signup');
});


//handing post requests from the signup page.
Website.post('/signup', [
    check("firstname", "must have a first name !").not().isEmpty(),
    check("lastname", "must have a last name !").not().isEmpty(),
    check("email", "must have an email !").isEmail(),
    check("password", "must have a password").not().isEmpty()
], (req,res) => {
    
    var errors = validationResult(req);

    if (!errors.isEmpty())
    {
        res.render("signup", {
            errors:errors.array()
        });

        return;
    }

    else 
    {
        const name = `${req.body.firstname} ${req.body.lastname}`;
        const email = req.body.email;
        const salt = randomSalt();
        const password = req.body.password;
        const hashedandsalted = crypto.createHmac("sha256", salt).update(secretPass).digest("hex");
        
        //creates the 1st session ID
        const sessionid = randomString();

        const newUser = new User({email: email, password: password, salt: salt, name: name, sessionid: sessionid});

        newUser.save().then(() =>{
            console.log('new user created');
            res.cookie("SESSION_ID", sessionid, {httpOnly:true});
        });
        res.redirect("/");
    }
      
    
    res.render('signup');
});


// creates a session after login attempted
Website.post('/login', (req, res) => {
    console.log(req.body);
    User.findOne({email: req.body.email}).exec( (err, user) => {
        console.log(user);

        if(req.body.password === user.password){
            console.log("auth successful");

            //generates the 2nd session ID
            const sessionid = randomString();

            //MongoDB updates the session ID here:
            User.updateOne({email: user.email}, {$set: {"sessionid": sessionid}}).exec((cb)=>{
                console.log(cb);
            });
            

            res.cookie("SESSION_ID", sessionid, {httpOnly:true});
            res.redirect('/');
        }

    });
});

Website.listen(1550, () => {
    console.log("Listening at 1550...");
});

//this function generates a random string which is the session id for a partcular user.
function randomString (){
    return crypto.randomBytes(32).toString('hex');
}

function randomSalt () {
    return crypto.randomBytes(16).toString("hex");
}