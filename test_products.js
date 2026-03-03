const URL = 'https://script.google.com/macros/s/AKfycbyQMiAAVzhDmnuj9YXjKkErPOHrOXIfTyMdgBpFHxEj6BwdIBzNqtAZwfzY2o7Z9js/exec';
(async () => {
    const res = await fetch(URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getProducts', token: 'mockToken' }),
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2).substring(0, 2000));
})();
