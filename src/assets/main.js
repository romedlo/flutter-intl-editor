
var labelEditors = document.querySelectorAll('.label-editor');

labelEditors.forEach(editor => {
    editor.addEventListener('focus', (event) => {
        let target = event.target;
        target.style.backgroundColor = 'red';
        
        let okBtn = document.createElement('button');
        okBtn.innerHTML = 'OK';
        okBtn.style.position = 'absolute';
        okBtn.style.right = '0';
        okBtn.style.top = '0';
        okBtn.style.backgroundColor = 'green';
        
        target.appendChild(okBtn);
    });

    editor.addEventListener('blur', (event) => {
        let target = event.target;
    });
});
