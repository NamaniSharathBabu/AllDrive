const registerForm = document.getElementById('registerForm');
const registerStatus = document.getElementById('registerStatus');

registerForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    registerStatus.textContent = '';
    const formdata = new FormData(registerForm)
    const data = Object.fromEntries(formdata.entries());
    console.log("Sending data:", data);
    const res = await fetch("http://localhost:8001/register",{
        method:"POST",
        body:JSON.stringify(data),
        headers:{
            "Content-Type":"application/json"
        }
    });

    const responseData = await res.json();
    console.log("Response:", responseData);
    
    if(!res.ok){
        registerStatus.textContent = responseData.message || res.statusText;
        return;
    }
    else{
        registerStatus.textContent = responseData.message || res.statusText;
        window.location.href = 'login.html';
        registerForm.reset();
    }
    })