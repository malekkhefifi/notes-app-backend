const jwt = require('jsonwebtoken');
const User = require('./models/user.models')

async function authenticateToken(req, res, next) {
    try { // const authHeader = req.headers["authorization"];
        //const token = authHeader && authHeader.split(' ')[1]; 
        const token = req.header("authorization");
        console.log("TOKEN", token);
        if (!token) return res.sendStatus(401); // Si le token n'existe pas

        /*jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
             if (err) return res.sendStatus(403); // Si le token est invalide
             req.user = user;
             next();
         });*/
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        console.log("decoded", decoded);
        const user = await User.findById(decoded.user.id).select('-password')
        console.log(user)
        if (!user) {
            return res.status(401).json({ msg: 'unauth' })
        }
        req.user = user
        next()
    } catch (err) {
        console.log(err)
        return res.status(500).json({ msg: 'server error' })
    }
}

module.exports = { authenticateToken };




