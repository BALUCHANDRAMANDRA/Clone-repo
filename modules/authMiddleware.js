const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.path}`);

    
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        console.log('No Authorization header found');
        return res.status(401).json({ message: 'Authorization header missing' });
    }

    
    console.log(`Authorization Header: ${authHeader}`);

    
    const token = authHeader.split(' ')[1];  
    if (!token) {
        console.log('Token missing in Authorization header');
        return res.status(401).json({ message: 'Token missing' });
    }

    
    console.log(`Extracted Token: ${token}`);

    try {
    
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(`Decoded Token: ${JSON.stringify(decoded)}`);
        req.user = decoded;
        next();
    } catch (err) {
        console.log(`JWT verification failed: ${err.message}`);
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
