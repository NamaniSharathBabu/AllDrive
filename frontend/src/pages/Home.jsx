import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaCloudUploadAlt, FaFileAlt, FaSignOutAlt, FaSearch, FaEllipsisV, FaFolder } from 'react-icons/fa';
import './Home.css';
import { useRef } from 'react';

const Home = () => {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState('');
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [showModal, setShowModal] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [folders, setFolders] = useState([]);
    const [currentPath, setCurrentPath] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeMenu, setActiveMenu] = useState(null);

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchFiles();
        fetchFolders();
    }, [token, navigate, currentPath]);

    const openFile = (fileId) => {
        window.open(
            `http://localhost:5000/api/files/${fileId}/view`,
            '_blank'
        );
    };

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

        await fetch('/api/folders', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: currentPath, folderName })
        });

        setShowModal(false);
        setFolderName('');
        fetchFolders(); // re-fetch folder list
    };
    const fetchFolders = async () => {
        try {
            console.log(currentPath);
            const res = await fetch('/api/folders?path=' + currentPath,
                {
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    }
                }
            )
            if (res.ok) {
                const data = await res.json();
                setFolders(data);
                console.log(data);

            }
        }
        catch (err) {
            console.log(err);
        }
    };

    const handelDeleteFolder = async (folderId) => {
        try {
            const res = await fetch('/api/folders/' + folderId, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            })
            if (res.ok) {
                setStatus('Folder deleted Successfully!');
                fetchFolders();
            }
        }
        catch (err) {
            console.log(err);
        }
    };

    const changeToNewFolder = (path) => {
        setCurrentPath(prev => prev + path + '/');
    };

    const handleGoBack = () => {
        setCurrentPath(prev => {
            if (!prev) return '';
            const parts = prev.split('/').filter(p => p);
            parts.pop();
            return parts.length > 0 ? parts.join('/') + '/' : '';
        });
    };
    const fileInputRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFiles = e.dataTransfer.files;

        if (fileInputRef.current) {
            fileInputRef.current.files = droppedFiles;
        }
    };
    const handleOpenFile = async (file) => {
        try {
            const fileId = file._id;
            const cacheName = 'file-cache';
            const requestUrl = `/api/files/content/${fileId}`;
            console.log(fileId + "before opening ifile in home.jsx")
            // Try to open from cache first
            const cache = await window.caches.open(cacheName);
            const cachedResponse = await cache.match(requestUrl);

            if (cachedResponse) {
                console.log("Opening from cache:", file.filename);
                const blob = await cachedResponse.blob(); // Blob - Binary Large Object(converting response to blob)
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
                return;
                // Blob = water in a bottle
                // URL = label on the bottle
                // Browser opens the bottle using the label
            }

            // If not in cache, download it
            setStatus(`Downloading ${file.filename}...`);
            console.log("Downloading file:", file.filename);

            const response = await fetch(requestUrl, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            // Clone response to put in cache (response body can only be consumed once)
            const responseClone = response.clone();
            await cache.put(requestUrl, responseClone);

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            setStatus(''); // Clear status
            window.open(url, '_blank');

        } catch (err) {
            console.error("Error opening file:", err);
            setStatus('Error opening file.');
        }
    };

    const toggleMenu = (fileId, e) => {
        e.stopPropagation();
        setActiveMenu(activeMenu === fileId ? null : fileId);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);
    return (
        <div className="home-container">
            <div className="container">
                <header className="home-header">
                    <h1 className="header-title">
                        <span className="text-primary">All</span>Drive
                    </h1>
                    <button onClick={() => navigate('/account')} className="btn btn-primary">Account</button>
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
                            <div className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e)}>
                                <input type="file" name="files" multiple className="file-input" ref={fileInputRef} />
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
                            <div className="folder-actions">
                                {currentPath && (
                                    <button className="btn btn-primary mr-2" onClick={handleGoBack}>
                                        Go Back
                                    </button>
                                )}
                                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Folder</button>
                            </div>
                        </div>
                        <ul className="file-list">
                            {folders.filter(folder => folder.filename.toLowerCase().includes(searchQuery.toLowerCase())).map((folder) => (
                                <li key={folder._id} className="file-item" onDoubleClick={() => changeToNewFolder(folder.filename)}>
                                    <div className="file-icon-wrapper" style={{ background: '#e0e0e0', color: '#5f6368' }}>
                                        <FaFolder />
                                    </div>
                                    <span className="file-name">{folder.filename}</span>

                                    <div className="menu-container">
                                        <button className="btn-icon three-dots-btn" onClick={(e) => toggleMenu(folder._id, e)}>
                                            <FaEllipsisV />
                                        </button>

                                        {activeMenu === folder._id && (
                                            <div className="menu-dropdown">
                                                <div className="menu-item" onClick={(e) => {
                                                    e.stopPropagation();
                                                    changeToNewFolder(folder.filename);
                                                    setActiveMenu(null);
                                                }}>Open</div>
                                                <div className="menu-item delete-item" onClick={(e) => {
                                                    e.stopPropagation();
                                                    handelDeleteFolder(folder._id);
                                                    setActiveMenu(null);
                                                }}>Delete</div>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
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
                                    <input type="text" className="input-field search-input" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {files.filter(file => (typeof file === 'string' ? file : (file.filename || '')).toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                            <div className="no-files">
                                <FaFileAlt className="no-files-icon" />
                                <p>No files found.</p>
                            </div>
                        ) : (
                            <ul className="file-list">
                                {files.filter(file => (typeof file === 'string' ? file : (file.filename || '')).toLowerCase().includes(searchQuery.toLowerCase())).map((file, index) => (
                                    <li key={index} className="file-item" onDoubleClick={() => handleOpenFile(file)}>
                                        <div className="file-icon-wrapper">
                                            <FaFileAlt />
                                        </div>
                                        <span className="file-name">
                                            {typeof file === 'string' ? file : file.filename || 'Untitled'}
                                        </span>

                                        <div className="menu-container">
                                            <button className="btn-icon three-dots-btn" onClick={(e) => toggleMenu(file._id || index, e)}>
                                                <FaEllipsisV />
                                            </button>

                                            {activeMenu === (file._id || index) && (
                                                <div className="menu-dropdown">
                                                    <div className="menu-item" onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenFile(file);
                                                        setActiveMenu(null);
                                                    }}>Open</div>
                                                    <div className="menu-item delete-item" onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(file);
                                                        setActiveMenu(null);
                                                    }}>Delete</div>
                                                </div>
                                            )}
                                        </div>
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
