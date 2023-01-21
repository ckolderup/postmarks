import basicAuth from 'express-basic-auth';

export const basicUserAuth = basicAuth({
  authorizer: asyncAuthorizer,
  authorizeAsync: true,
  challenge: true
});

function asyncAuthorizer(username, password, cb) {
  let isAuthorized = false;
  const isUsernameAuthorized = username === 'admin';
  const isPasswordAuthorized = password === process.env.ADMIN_KEY;
  isAuthorized = isPasswordAuthorized && isUsernameAuthorized;
  if (isAuthorized) {
    return cb(null, true);
  }
  else {
    return cb(null, false);
  }
}