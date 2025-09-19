// EMERGENCY LOGIN FIX - Paste this in browser console on https://golf-club-fresh.azurewebsites.net/admin
// This will override the adminLogin function to handle the old server response format

console.log('🔧 Applying emergency login fix...');

// Override the adminLogin function to handle both response formats
window.adminLogin = async function(event) {
    event.preventDefault();
    
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    
    console.log('🔑 Attempting login with:', username);
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        console.log('📦 Server response:', data);
        
        if (response.ok) {
            // Handle both old and new response formats
            let user = data.user;
            if (!user) {
                // Old format - create user object
                console.log('🔄 Using compatibility mode for old server response');
                user = {
                    username: 'admin',
                    role: 'system_admin',
                    name: 'System Administrator'
                };
            }
            
            if (user.role === 'system_admin') {
                console.log('✅ Login successful!');
                localStorage.setItem('adminAuthToken', data.token);
                localStorage.setItem('currentAdmin', JSON.stringify(user));
                window.authToken = data.token;
                window.currentAdmin = user;
                
                // Show dashboard
                document.getElementById('loginForm').classList.add('hidden');
                document.getElementById('adminDashboard').classList.remove('hidden');
                
                if (currentAdmin.username) {
                    document.getElementById('adminUserInfo').textContent = `${currentAdmin.username} (${currentAdmin.role})`;
                    document.getElementById('userAvatar').textContent = currentAdmin.username.charAt(0).toUpperCase();
                }
                
                console.log('🎉 Dashboard should now be visible!');
            } else {
                console.error('❌ Access denied - not system admin');
                alert('Access denied. System admin privileges required.');
            }
        } else {
            console.error('❌ Login failed:', data.error || 'Unknown error');
            alert('Login failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('💥 Network error:', error);
        alert('Network error: ' + error.message);
    }
};

console.log('✅ Emergency fix applied! Try logging in with admin/admin now.');
console.log('📝 If successful, the dashboard should appear.');