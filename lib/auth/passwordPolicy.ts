export const PASSWORD_MIN_LENGTH=12;
export function validateNewPassword(password:unknown,confirmation?:unknown):string{
 if(typeof password!=='string'||[...password].length<PASSWORD_MIN_LENGTH)throw new Error('Use at least 12 characters for your password.');
 if(password.length>1024)throw new Error('Use a password no longer than 1024 characters.');
 if(confirmation!==undefined&&password!==confirmation)throw new Error('The passwords do not match.');
 return password;
}
