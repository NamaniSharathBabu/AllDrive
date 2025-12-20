import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaCloudUploadAlt, FaFileAlt, FaSignOutAlt, FaSearch } from 'react-icons/fa';
import './Home.css';


const Home = () => {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState('');
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [showModal, setShowModal] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [folders, setFolders] = useState([]);

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchFiles();
    }, [token, navigate]);

    const location = useLocation();

    const currentPath = location.pathname
        .replace('/folders', '')
        .replace(/^\/+/, '');

    const fetchFiles = async () => {
        try {

            const res = await fetch(`/api/files?path=${encodeURIComponent(currentPath || '')}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (res.status === 401) {
                handleLogout();
                return;
            }

            const data = await res.json();
            setFiles(data);
            // console.log(data);
        } catch (err) {
            console.error('Error fetching files:', err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        formData.append('path', currentPath || '');
        setUploading(true);
        setStatus('');

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (res.ok) {
                setStatus('Files uploaded successfully!');
                e.target.reset();
                fetchFiles();
            } else {
                setStatus('Upload failed.');
            }
        } catch (err) {
            setStatus('Error uploading files.');
        } finally {
            setUploading(false);
        }
    };
    const handleDelete = async (file) => {
        try {
            const fileId = file._id;
            console.log(file);
            const res = await fetch('/api/files/' + fileId, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            })
            if (res.ok) {
                setStatus('File deleted Successfully!');
                fetchFiles();
            }
        }
        catch (err) {
            console.log(err);
        }
    };
    const handleCreateFolder = async () => {
        const fullPath = currentPath
            ? `${currentPath}/${folderName}`
            : folderName;

        await fetch('/api/folders', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: fullPath, folderName })
        });

        setShowModal(false);
        setFolderName('');
        fetchFolders(); // re-fetch folder list
    };
    const fetchFolders  = async () =>{
        try{
            const res = await fetch('/api/folders?path=' + currentPath,
                {headers :{
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }}
            )
            if(res.ok){
                const data = await res.json();
                setFolders(data);
                console.log(data);
                
            }
        }
        catch(err){
            console.log(err);
        }
    };
    useEffect(() => {
        fetchFolders();
    }, [currentPath]);
    
    return (
        <div className="home-container">
            <div className="container">
                <header className="home-header">
                    <h1 className="header-title">
                        <span className="text-primary">All</span>Drive
                    </h1>
                    <button onClick={handleLogout} className="btn btn-logout">
                        <FaSignOutAlt /> Logout
                    </button>
                </header>

                <div className="grid-container">

                    {/* Upload Section */}
                    <div className="card glass">
                        <h2 className="section-title">
                            <FaCloudUploadAlt className="icon-primary" /> Upload Files
                        </h2>
                        <form onSubmit={handleUpload}>
                            <div className="dropzone">
                                <input type="file" name="files" multiple className="file-input" />
                                <p className="dropzone-text">
                                    Drag and drop or review files
                                </p>
                            </div>
                            <button type="submit" disabled={uploading} className="btn btn-primary btn-full-width">
                                {uploading ? 'Uploading...' : 'Upload Now'}
                            </button>
                            {status && (
                                <p className={`status-message ${status.includes('success') ? 'status-success' : 'status-error'}`}>
                                    {status}
                                </p>
                            )}
                        </form>
                    </div>
                    {/* Folder Section */}

                    <div className='card glassfolder-section'>
                        <div className='folder-section'>
                            <h2 className="files-title">Your Folders</h2>
                            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Folder</button>
                        </div>
                        {/* <div className="folder-list">
                            {folders.map((folder) => (
                                <div key={folder._id} className="folder-item">
                                    <h3>{folder.filename}</h3>
                                    <button className="btn btn-primary" onClick={() => navigate(`/folders/${folder._id}`)}>View</button>
                                </div>
                            ))}
                        </div> */}
                    </div>
                    {showModal && (
                        <div className="modal-overlay">
                            <div className="modal-box">
                                <h3>Create New Folder</h3>

                                <input type="text" placeholder="Folder name" value={folderName} onChange={(e) => setFolderName(e.target.value)} autoFocus />

                                <div className="modal-actions">
                                    <button className="btn btn-secondary" onClick={() => {
                                        setShowModal(false);
                                        setFolderName('');
                                    }}>Cancel</button>

                                    <button className="btn btn-primary" onClick={handleCreateFolder} disabled={!folderName.trim()}>Create</button>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Files Section */}
                    <div className="card glass files-section">
                        <div className="files-header">

                            <h2 className="files-title">Your Files</h2>
                            <div className="input-group search-container">

                                <div className="search-wrapper">
                                    <FaSearch className="search-icon" />
                                    <input type="text" className="input-field search-input" placeholder="Search..." />
                                </div>
                            </div>
                        </div>

                        {files.length === 0 ? (
                            <div className="no-files">
                                <FaFileAlt className="no-files-icon" />
                                <p>No files found. Start uploading!</p>
                            </div>
                        ) : (
                            <ul className="file-list">
                                {files.map((file, index) => (
                                    <li key={index} className="file-item">
                                        <div className="file-icon-wrapper">
                                            <FaFileAlt />
                                        </div>
                                        <span className="file-name">
                                            {typeof file === 'string' ? file : file.filename || 'Untitled'}
                                        </span>
                                        <button onClick={() => handleDelete(file)} className="btn btn-delete btn btn-warning">Delete</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
