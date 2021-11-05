const express = require("express");
const Mongo = require("mongoose");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const { urlencoded } = require("body-parser");
const {check, validationResult} = require("express-validator");
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const fileUploader = require("express-fileupload");
const formidable = require("formidable");

const Website = express();
Website.use(bodyParser.urlencoded({extended: false}));
Website.use(cookieParser());
Website.use(express.static("public"));
Website.use(fileUploader());
var result = require("dotenv").config();

if (result.error)
{
    console.log("ENV Error: " + result.error);
}

const port = process.env.PORT || 3000;

Website.set("views", "pages");
Website.set("view engine", "ejs");

Mongo.connect(process.env.URL,
    {useNewUrlParser: true},
    () => console.log("connected to ClassRoom DB...")
);

//Login users for MongoDB
const User = Mongo.model("user",
    {
        email: String,
        password: String,
        salt: String,
        name: String,
        sessionid: String
    }
);

const Student = Mongo.Schema(

    {
        firstName: String,
        lastName: String,
        DOB: String,
        address: String,
        city: String,
        country: String,
        image: {
            data: Buffer,
            mimetype: String
        }
    }

);

const Lesson = Mongo.Schema(
    {
        lessonName:String,
        textarea: String,
        lessonDate: String,
        attendance: [String]
    }
);

const Class = Mongo.model("class", 
    {
        className: String,
        classLevel: String,
        startDate: String,
        endDate: String,
        level: String,
        userid: String,
        students: [Student],
        lessons: [Lesson]
    }
);

const authenticate = (req, res, next) => {
    const sessionid = req.cookies.SESSION_ID;
    
    User.findOne({sessionid: sessionid}).exec((err, user) => {

        if(err || user === null){
            
            console.log(user);
            res.status(401);
            res.redirect("/login");
            
        }
        else
        {
            req.user = user;
            next();
        }

    });
};

Website.get("/", authenticate, (req,res) => {

        Class.find({userid: req.user._id}, (err, docs) => {
            console.log("docs: " + docs);

        
            res.render("home", {name: req.user.name, classes: docs});
        

            
        });
        

});

Website.get('/signup', (req, res) => {
    res.render('signup');
});

Website.get('/login', (req, res) => {
    res.render('login');
});

// handles the class page
Website.get('/class/:id/',authenticate, (req, res) => {

    Class.findOne({_id: req.params.id, userid: req.user._id}).exec((err, classDoc) => {

        if (classDoc === null)
        {
            console.error('Class not found');
            res.status('404');
            res.render('404')
            return;
        }

    
        // console.log(classDoc);
        res.render('class', classDoc);
        
    })
    
});

// lesson page

Website.get("/class/:classid/lesson/:lessonid", authenticate, (req, res) => {
    const classid = req.params.classid;
    const lessonid = req.params.lessonid;
    
    Class.findOne({_id: classid, userid:req.user._id}).exec((err, classDoc) => {
    
        if(err)
        {
            console.error(err)
        }

        if (classDoc !== null)
        {
            const lessonDoc = classDoc.lessons.id(lessonid);
            const students = classDoc.students;

            console.log(lessonDoc);
            let attendance = [];
            let absent = [];

            for (studentid of lessonDoc.attendance){
                if(students.id(studentid))
                    attendance.push(students.id(studentid));
            }
            res.render('lesson', {result: lessonDoc, students: students, attendance: attendance, absent: absent});
            
        }

    });
   
    
    
      
    
});

//student page

Website.get("/class/:classid/student/:studentid",authenticate, (req, res) => {
    const classid = req.params.classid;
    const studentid = req.params.studentid;
    
    Class.findOne({_id: classid, userid:req.user._id}).exec((err, classDoc) => {
    
        if(err)
        {
            console.error(err)
        }

        if (classDoc !== null)
        {
            const studentDoc = classDoc.students.id(studentid);
            if(!studentDoc){
                res.redirect(`/class/${classid}/`);
            }
            let studentID = classDoc.students;
            let lessons = classDoc.lessons;
            let lessonQuantity = classDoc.lessons.length;

            // student attendance percentage 
            var totalAttendance = [];
            let attendancePercentage = 0;
            var counter = 0;
            

            for (lesson of lessons)
            {
                for(attendance of lesson.attendance){
                    totalAttendance.push(attendance);
                }
            }

            for (i of totalAttendance)
            {
                if (studentid == i)
                {
                    counter += 1;

                }
            }
            attendancePercentage = (counter / lessonQuantity) * 100; 

            

          /*   console.log(studentDoc);
            console.log("Student ID: " + studentid);
            console.log("Student Attendance: " + attendancePercentage);
            console.log("Lesson Quantity: " + lessonQuantity);
            console.log("Counter " + counter); */

            res.render('student', {student: studentDoc, attendance: attendancePercentage});
            
        }

    });
   
});

//handle logout
Website.get('/logout', (req, res) =>  {
    res.cookie('SESSION_ID', '', {maxAge: 1});
    res.redirect('/');
});


//handing post requests from the signup page.
Website.post('/signup', [
    check("firstname", "must have a first name !").not().isEmpty(),
    check("lastname", "must have a last name !").not().isEmpty(),
    check("email", "must have an email !").isEmail(),
    check("password", "must have a password").not().isEmpty()
], (req,res) => {
    
    var errors = validationResult(req);
    var password = req.body.password;
    var password2 = req.body.passwordConfirm;

    //validation for same email address
    User.findOne({email: req.body.email}).exec((err, user) => {
        console.log("user: " + user);

        if (user !== null)
        {
            res.render("signup", {
                message: "Email address is already taken !"
            });
        }

        else
        {
            //validations for all signup input
            if (!errors.isEmpty())
            {
                    res.render("signup", {
                    errors:errors.array()
                });

            }

            // validation for confirming password
            if (password !== password2)
            {
                res.render("signup", {
                    message: "Passwords do not match !"
                });
            }

            else 
            {
                const name = `${req.body.firstname} ${req.body.lastname}`;
                const email = req.body.email;
                const salt = randomSalt();
                const password = req.body.password;
                const hashedandsaltedpassword = crypto.createHmac("sha256", salt).update(password).digest("hex");
        
                //creates the 1st session ID
                const sessionid = randomString();

                const newUser = new User({email: email, password: hashedandsaltedpassword, salt: salt, name: name, sessionid: sessionid});

                newUser.save().then(() => {
                    console.log('new user created');
                    res.cookie("SESSION_ID", sessionid, {httpOnly:true});

                    // nodemailer for email confirmations 

                    var transporter = nodemailer.createTransport({
                        host: "smtp.gmail.com",
                        port: "465",
                        service: "gmail",
                        secure: true,
                        auth:
                        {
                            user: process.env.EMAIL, 
                            pass: process.env.PASS
                        }
                    });

                    var mailOptions = {
                        from: process.env.EMAIL,
                        to: email,
                        subject: "Confirmation Email !",
                        text: `You have created an account with us. Congratulations! \n\nRegards,\n\n ClassRoom Team`
                    }

                    transporter.sendMail(mailOptions, (err, info) => {
                        if (err)
                        {
                            console.log(err);
                        }

                        else
                        {
                            console.log("Email sent: " + info.response);

                        }
                    });

                    res.redirect("/");
                });
            }

        }
    });

    

});


// creates a session after login attempted
Website.post('/login', (req, res) => {
    console.log(req.body);

    User.findOne({email: req.body.email}).exec( (err, user) => {
        console.log("User: " + user);
        console.log("err: " + err);

        //if email doesn't match ...
        
        if (user === null)
        {
            
            res.status(404).render("login", {
                message: "Invalid email !"
            });
    
        }

        else 
        {
             //hash incoming password and salt 
            const pass = req.body.password;
            const salt = user.salt;

            const hashedInputPassword = crypto.createHmac('sha256', salt).update(pass).digest('hex');

            if (hashedInputPassword === user.password)
            {
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

            // if password doesm't match ...
            else
            {
                res.status(404).render("login", {
                    message: "Invalid credentials !"
                });
            }

        }

    });
       
         
});


//Post request for adding a class record
Website.post("/addclass", authenticate, (req, res) => {
    console.log(req.body);


    const userid = req.user._id;

    console.log(userid);
    const newClass = new Class({className: req.body.className, level: req.body.level, startDate: req.body.startDate, endDate: req.body.endDate, userid: userid});
    
    newClass.save().then(() => {
        console.log("class added !");
        res.redirect('/')
    });


});



//Post request for adding a student to a class

Website.post('/addstudent/:id', authenticate, (req, res) => {
    const classid = req.params.id;

    let data = req.body;
    const image = req.files.image;
    
    const necessaryImgData = {
        data: image.data,
        mimetype: image.mimetype
    }

    data.image = necessaryImgData;

    // console.log('classid', classid);

    // console.log("Data", data);

    Class.findOne({_id: classid, userid: req.user._id}).exec((err, classdoc) => {
        if(err)
        {
            console.log("Cannot find the class ...");
            res.send('Cound not find the class');
            return;
        }

        classdoc.students.push(data);
        

        classdoc.save()
            .then(saveddoc => {
                // console.log('Added a new student', saveddoc);
                res.redirect('back');
            })
            .catch(err => res.send(err));
        
        
    });
   

});

// Post request for creating a lesson record.
Website.post('/addlesson/:id',authenticate, (req, res) =>{
    const classid = req.params.id;

    const data = req.body;  

    console.log('classid', classid);

    console.log("Data", data);

    Class.findOne({_id: classid, userid: req.user._id}).exec((err, classdoc) => {
        if(err){
            //handle error
            return;
        }
      
        classdoc.lessons.push(data);
        classdoc.save()
            .then( saveddoc => {
                console.log('Added a new student', saveddoc);
                res.redirect('back');
            })
            .catch(err => res.send(err));
        
    });

});

//Post request for handling attendance
Website.post("/class/:classid/lesson/:lessonid",authenticate, (req, res) => {
    const classid = req.params.classid;
    const lessonid = req.params.lessonid;
    
    console.log(req.body);

    Class.findOne({_id: classid, userid: req.user._id}).exec((err, classDoc) => {
        const lessonDoc = classDoc.lessons.id(lessonid);
        
        for (const studentid in req.body){
            
            if (classDoc.students.id(studentid)){
                lessonDoc.attendance.push(studentid);
            }
        }
        classDoc.save().then((err, savedDoc) => {
            if(err){
                console.error(err);
            }
            res.redirect('back')
        });

    })
    
   

});
Website.delete('/class/:classid/student/:studentid', authenticate, (req, res) => {
    
    Class.findOne({_id:req.params.classid, userid: req.user._id}).exec((err, classDoc)=>{
        const studentDoc = classDoc.students.id(req.params.studentid);
        studentDoc.remove();
        
        classDoc.save().then((err, savedDoc) => {
            console.log('did we get here? that is the question. ')
     
            console.log('removed student sucessfully')
            res.send('removed student successfully');
            
        });
    });
    
    
});

Website.listen(port, () => {
    console.log("Listening at ", port);
});

//this function generates a random string which is the session id for a partcular user.
function randomString (){
    return crypto.randomBytes(32).toString('hex');
}

//this function generates a random string for the salted passwords.
function randomSalt () {
    return crypto.randomBytes(16).toString("hex");
}