/**
 * Middleware to handle any uncaught exceptions.
 * @param err
 * @param req
 * @param res
 * @param next
 */
exports.errorHandler = (err, req, res, next) => {
  // We log the error internaly
  console.log('err > ', err);
  // appLogger.error(err);

  const errRes = err;
  //  Remove Error's `stack` property. We don't want users to see this at the production env
  if (req.app.get('env') !== 'development') {
    delete errRes.stack;
  }

  const httpErr = errRes.http;
  delete errRes.http;

  // This responds to the request
  res.status(httpErr || 500).json({
    status: false,
    message: 'Something went wrong',
    error: errRes,
  });
};
