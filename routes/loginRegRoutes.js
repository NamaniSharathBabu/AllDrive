import userModel from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { deriveUserMasterKey } from "./uploadFiles.js";
import crypto from 'crypto';

export async function login(req, res) {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    try {
        const user = await userModel.findOne({ email: email });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log("Login failed: Invalid credentials");
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        if (!user.salt) {
            console.error(`Login critical error: User record ${user._id} missing salt`);
            return res.status(500).json({ success: false, message: "Account corrupted (missing salt). Please register a new account." });
        }

        //createin a jwt token
        const userMasterKey = await deriveUserMasterKey(password, user.salt);
        req.session.userMasterKey = userMasterKey.toString('hex');

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: { name: user.name, email: user.email }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Login failed: " + error.message });
    }
}

export async function register(req, res) {
    try {
        const { username, email, password } = req.body;
        console.log("Register request body:", req.body);

        if (!username || !email || !password) {
            console.log("Missing fields - username:", username, "email:", email, "password:", password);
            return res.status(400).json({ success: false, message: "Username, email and password are required" });
        }

        const existingUser = await userModel.findOne({ email: email });
        if (existingUser) {
            console.log("User already exists with email:", email);
            return res.status(400).json({ success: false, message: "Email already registered" });
        }
        const salt = crypto.randomBytes(16).toString('hex');
        const newUser = new userModel({ name: username, email, password: password, salt });
        await newUser.save();
        // console.log("User registered successfully:", email);
        res.status(201).json({ success: true, message: "User registered successfully" });
    } catch (error) {
        // console.error("Register error:", error);
        res.status(500).json({ success: false, message: "Registration failed: " + error.message });
    }
}
