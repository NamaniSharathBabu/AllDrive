
function Account() {
    const user = JSON.parse(localStorage.getItem('user'));
    return (
        <div>
            <h1>Account</h1>
            <p>Username : {user.name}</p>
            <p>Email : {user.email}</p>
        </div>
    );
}
export default Account;
