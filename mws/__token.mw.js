module.exports = ({ meta, config, managers }) =>{
    return ({req, res, next})=>{
        const auth  = req.headers.authorization;
        const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
        if(!token){
            console.log('token required but not found')
            return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'unauthorized'});
        }
        let decoded = null
        try {
            decoded = managers.token.verifyShortToken({token});
            if(!decoded){
                console.log('failed to decode-1')
                return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'unauthorized'});
            };
        } catch(err){
            console.log('failed to decode-2')
            return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'unauthorized'});
        }
    
        next(decoded);
    }
}