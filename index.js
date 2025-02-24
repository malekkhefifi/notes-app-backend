require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Pour le hachage des mots de passe
const User = require('./models/user.models');
const { authenticateToken } = require('./token');
const config = require('./config.json');
const path = require('path');

const Note = require("./models/Note-models");
const app = express();
app.use(express.json());
app.use(cors());

// Connexion à la base de données MongoDB
mongoose.connect(config.connectionString)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err));


// Route principale
app.get("/", (req, res) => {
    res.status(200).json({ message: "Hello World!" });
});
// Route protégée
app.get("/protected-route", authenticateToken, (req, res) => {
    res.json({ message: "This is a protected route." });
});
// Route de création de compte
app.post("/create-account", async (req, res) => {
    const { fullName, email, password } = req.body;

    // Vérification des champs obligatoires
    if (!fullName) {
        return res.status(400).json({ error: true, message: "Full Name is required." });
    }

    if (!email) {
        return res.status(400).json({ error: true, message: "Email is required." });
    }

    if (!password) {
        return res.status(400).json({ error: true, message: "Password is required." });
    }

    try {
        // Vérifier si l'utilisateur existe déjà
        const isUser = await User.findOne({ email: email });
        if (isUser) {
            return res.status(400).json({ error: true, message: "User already exists." });
        }

        // Sécuriser le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer un nouvel utilisateur
        const user = new User({
            fullName,
            email,
            password: hashedPassword
        });
        await user.save();

        // Créer un token JWT
        const accessToken = jwt.sign({ id: user._id, email: user.email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });

        return res.status(201).json({
            error: false,
            message: "Registration successful",
            user: {
                fullName: user.fullName,
                email: user.email,
                id: user._id
            },
            accessToken  // Le token JWT est envoyé ici
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: true, message: "Internal server error." });
    }
});

// Route protégée avec authentification par token
app.get("/protected", authenticateToken, (req, res) => {
    res.json({ message: "This is a protected route", user: req.user });
});
/************login */
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email) {
            return res.status(400).json({ error: true, message: "Email is required." });
        }
        if (!password) {
            return res.status(400).json({ error: true, message: "Password is required." });
        }
        const userInfo = await User.findOne({ email: email });
        console.log(userInfo)
        if (!userInfo) {
            return res.status(400).json({ error: true, message: "User not found." });
        }

        const ismatch = bcrypt.compare(password, userInfo.password)
        if (!ismatch) {
            return rex.status(400).json({ msg: 'invalid ' })
        }
        const payload = { user: { id: userInfo._id } }
        // const payload = { id: userInfo._id }
        const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '1d' });
        return res.status(200).json({ msg: 'user logged', userInfo, accessToken })


    }
    catch (err) {
        console.log(err)
        return res.status(500).json({ msg: 'server  error' })
    }
});
/****************Get User */
app.get("/get-user", authenticateToken, async (req, res) => {
    try {
        const { user } = req;  // This assumes the 'user' has been added to the request by the middleware
        console.log("Fetching user details for:", user._id);

        const isUser = await User.findOne({ _id: user._id });

        if (!isUser) {
            console.log(`User with ID ${user._id} not found`);
            return res.sendStatus(401);  // Unauthorized if the user is not found
        }

        console.log(`User details for ${user._id} found successfully`);
        return res.json({
            user: {
                fullName: isUser.fullName,
                email: isUser.email,
                _id: isUser._id,
                createdOn: isUser.createdOn,
            },
            message: "User data fetched successfully",
        });
    } catch (error) {
        console.error("Error while fetching user:", error);
        return res.status(500).json({ message: "An error occurred while fetching the user." });
    }
});

/*************** Add Note */
app.post("/add-note", authenticateToken, async (req, res) => {
    console.log("Request received at /add-note:", req.body);

    const { title, content, tags } = req.body;
    const user = req.user; // `authenticateToken` doit ajouter `user` à `req`

    if (!title) {
        console.log("Error: Title is missing");
        return res.status(400).json({ error: true, message: "Title is required" });
    }

    if (!content) {
        console.log("Error: Content is missing");
        return res.status(400).json({ error: true, message: "Content is required" });
    }

    try {
        const note = new Note({
            title,
            content,
            tags: tags || [],
            userId: user.id, // Récupération de l'ID utilisateur depuis le token
        });

        await note.save();
        console.log("Note saved successfully:", note);

        return res.json({
            error: false,
            note,
            message: "Note added successfully",
        });

    } catch (error) {
        console.error("Error while saving note:", error);
        return res.status(500).json({
            error: true,
            message: "Internal server error",
        });
    }
});

/************ Edit Note ************/
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const { title, content, tags, isPinned } = req.body;
    const { user } = req;  // Correction ici, user est dans req et pas req.body

    console.log(" Request received to edit note:", noteId);
    console.log(" User ID:", user.id);
    console.log(" Request body:", req.body);

    // Vérification des champs envoyés
    if (!title && !content && !tags && typeof isPinned !== "boolean") {
        console.log(" No valid fields to update.");
        return res.status(400).json({ error: true, message: "No changes provided." });
    }

    try {
        // Vérifier si la note existe
        const note = await Note.findOne({ _id: noteId, userId: user.id });

        if (!note) {
            console.log(" Note not found.");
            return res.status(404).json({ error: true, message: "Note not found." });
        }

        console.log(" Note found:", note);

        // Mise à jour des champs si présents
        if (title) note.title = title;
        if (content) note.content = content;
        if (tags) note.tags = tags;
        if (typeof isPinned === "boolean") note.isPinned = isPinned; // Correction

        await note.save();

        console.log(" Note updated successfully:", note);

        return res.json({
            error: false,
            note,
            message: "Note updated successfully",
        });

    } catch (error) {
        console.error(" Error updating note:", error);
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        });
    }
});

/*************** GET ALL NOTES */
app.get("/get-all-notes", authenticateToken, async (req, res) => {  // Correction : bien mettre "req, res" avec une virgule entre les deux
    try {
        const user = req.user
        const userId = user.id;
        console.log(userId)
        const notes = await Note.find({ userId });  // Récupère toutes les notes depuis la base de données
        return res.status(200).json(notes);  // Répond avec les notes et un statut 200 (OK)
    } catch (error) {
        console.error("Error fetching notes:", error);  // Affiche l'erreur dans la console
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",  // Réponse d'erreur en cas de problème
        });
    }
});

/******************Delete note */
app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const user = req.user; // Corrected: accessing req.user directly

    console.log("Request to delete note received");
    console.log("Note ID to delete:", noteId);
    console.log("User ID:", user._id);

    try {
        // Try to find the note by ID and userId
        const note = await Note.findOne({ _id: noteId, userId: user._id });

        // If the note doesn't exist, return a 404 error
        if (!note) {
            console.log("Note not found for this user");
            return res.status(404).json({
                error: true,
                message: "Note not found"
            });
        }

        // Delete the note if found
        await Note.deleteOne({ _id: noteId, userId: user._id });

        console.log("Note deleted successfully:", noteId);

        return res.json({
            error: false,
            message: "Note deleted successfully",
        });

    } catch (error) {
        // If an error occurs, log it and return a 500 error
        console.error("Error while deleting note:", error);
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        });
    }
});

/*****************Update isPinned Value */
app.put("/update-note-pinned/:noteId", authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const { isPinned } = req.body;
    const user = req.user; // L'utilisateur est directement dans req

    console.log("Request received to update pinned status of a note.");
    console.log("Note ID:", noteId);
    console.log("User ID:", user.id);
    console.log("Request Body:", req.body);

    try {
        // Vérifier si la note existe
        const note = await Note.findOne({ _id: noteId, userId: user.id });

        if (!note) {
            console.log("Note not found.");
            return res.status(404).json({ error: true, message: "Note not found." });
        }

        console.log("Note found:", note);

        // Mise à jour du statut "isPinned" seulement s'il est défini dans la requête
        if (typeof isPinned !== "undefined") {
            console.log(`Updating "isPinned" status to: ${isPinned}`);
            note.isPinned = isPinned;
        }

        await note.save();

        console.log("Note updated successfully:", note);

        return res.json({
            error: false,
            note,
            message: "Note pinned status updated successfully."
        });

    } catch (error) {
        console.error("Error updating note:", error);
        return res.status(500).json({
            error: true,
            message: "Internal Server Error"
        });
    }
});
/*******************Search Notes*/
app.get("/search-notes/", authenticateToken, async (req, res) => {
    const { user } = req;  // Correct destructuring
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({
            error: true,
            message: "Search query is required"
        });
    }

    try {
        console.log("Searching notes for user:", user._id, "with query:", query); // Debugging log

        const matchingNotes = await Note.find({
            userId: user._id,
            $or: [
                { title: { $regex: new RegExp(query, "i") } },
                { content: { $regex: new RegExp(query, "i") } }
            ]
        });

        console.log("Found matching notes:", matchingNotes); // Debugging log

        return res.json({
            error: false,
            notes: matchingNotes,
            message: "Notes matching the search query retrieved successfully"
        });
    } catch (error) {
        console.error("Error occurred while searching notes:", error); // Error log
        return res.status(500).json({
            error: true,
            message: "Internal Server Error"
        });
    }
});

// const __dirname = path.resolve();
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../notes-app/dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../notes-app", "dist", index.html'));
    });
}
console.log(__dirname)

// Lancement du serveur
app.listen(8000, () => {
    console.log('Server is running on port 8000');
});

module.exports = app;





