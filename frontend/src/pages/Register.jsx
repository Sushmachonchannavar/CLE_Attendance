import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        collegeName: '',
        departmentName: '',
        mobile: ''
    });
    const navigate = useNavigate();
    const { register } = useAuth();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        const result = await register(formData);
        if (result.success) {
            alert(result.message || 'Registration successful! Redirecting to login.');
            navigate('/login');
        } else {
            alert(result.error || 'Registration failed. Please try again.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 py-10">
            <div className="p-8 bg-white rounded-lg shadow-xl w-96">
                <h2 className="mb-6 text-3xl font-bold text-center text-blue-900">Register</h2>
                <form onSubmit={handleRegister}>
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-bold text-gray-700">First Name</label>
                        <input
                            type="text"
                            name="firstName"
                            className="w-full px-3 py-2 border rounded shadow appearance-none focus:outline-none focus:shadow-outline"
                            value={formData.firstName}
                            onChange={handleChange}
                            placeholder="Enter First Name"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-bold text-gray-700">Last Name</label>
                        <input
                            type="text"
                            name="lastName"
                            className="w-full px-3 py-2 border rounded shadow appearance-none focus:outline-none focus:shadow-outline"
                            value={formData.lastName}
                            onChange={handleChange}
                            placeholder="Enter Last Name"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-bold text-gray-700">College Name</label>
                        <input
                            type="text"
                            name="collegeName"
                            className="w-full px-3 py-2 border rounded shadow appearance-none focus:outline-none focus:shadow-outline"
                            value={formData.collegeName}
                            onChange={handleChange}
                            placeholder="Enter College Name"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-bold text-gray-700">Department Name</label>
                        <input
                            type="text"
                            name="departmentName"
                            className="w-full px-3 py-2 border rounded shadow appearance-none focus:outline-none focus:shadow-outline"
                            value={formData.departmentName}
                            onChange={handleChange}
                            placeholder="Enter Department Name"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-bold text-gray-700">Mobile Number</label>
                        <input
                            type="text"
                            name="mobile"
                            className="w-full px-3 py-2 border rounded shadow appearance-none focus:outline-none focus:shadow-outline"
                            value={formData.mobile}
                            onChange={handleChange}
                            placeholder="Enter Mobile Number"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full px-4 py-2 font-bold text-white rounded focus:outline-none focus:shadow-outline transition-all"
                        style={{ backgroundColor: '#E34A27' }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#c43a1d'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#E34A27'}
                    >
                        Register
                    </button>
                    <div className="mt-4 text-center">
                        <p className="text-sm text-gray-600">
                            Already have an account?{' '}
                            <Link to="/login" className="text-blue-600 font-bold hover:underline">
                                Login here
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Register;
