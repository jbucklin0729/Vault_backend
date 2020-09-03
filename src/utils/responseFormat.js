class ResponseFormat {
    static handleSuccess(res, obj) {
        const {
            status,
            statusCode,
            data,
            historyData,
            metadata,
        } = obj;
        return res.status(statusCode).json({
            statusCode,
            status,
            data,
            metadata,
            historyData,
        });
    }

    static handleError(res, obj) {
        res.status(obj.statusCode).json(obj);
    }


    // static handleAuth(obj) {
    //     const { res, status, statusCode, message, token } = obj;
    //     return res.status(statusCode).json({
    //         status,
    //         message,
    //         token
    //     });
    // }
}

module.exports = ResponseFormat;