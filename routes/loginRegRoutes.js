import userModel from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function login(req, res){
    const {email, password} = req.body;
    if(!email || !password){
        console.log("not all fields");
        return res.status(400).json({success:false, message:"Email and password are required"});
    }
    const user = await userModel.findOne({email:email});
    if(!user){
        console.log("User not found");
        return res.status(400).json({success:false, message:"User not found"});
    }
   
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch){
        console.log("Invalid credentials");
        return res.status(400).json({success:false, message:"Invalid credentials"});
    }
    //createin a jwt token
      const token = jwt.sign(
        { id: user._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: "1h" }
    );

    res.status(200).json({
        success: true,
        message: "Login successful",
        token, 
        user: { name: user.name, email: user.email }
    });
    // console.log("Login successful");
    // res.status(200).json({success:true, message:"Login successful", user:{name:user.name, email:user.email}});
}

export async function register(req, res){
    try {
        const {username, email, password} = req.body;
        console.log("Register request body:", req.body);
        
        if(!username || !email || !password){
            console.log("Missing fields - username:", username, "email:", email, "password:", password);
            return res.status(400).json({success:false, message:"Username, email and password are required"});
        }
        
        const existingUser = await userModel.findOne({email: email});
        if(existingUser){
            console.log("User already exists with email:", email);
            return res.status(400).json({success:false, message:"Email already registered"});
        }
        
        const newUser = new userModel({name:username, email, password:password});
        await newUser.save();
        console.log("User registered successfully:", email);
        res.status(201).json({success:true, message:"User registered successfully"});
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({success:false, message:"Registration failed: " + error.message});
    }
}