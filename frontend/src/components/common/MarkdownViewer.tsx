import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import './MarkdownViewer.css';

interface MarkdownViewerProps {
    markdownPath: string;
    onClose: () => void;
    title?: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ markdownPath, onClose, title = 'Documentation' }) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [language, setLanguage] = useState<'en' | 'zh'>('en');
    const [currentPath, setCurrentPath] = useState<string>(markdownPath);
    const contentRef = React.useRef<HTMLDivElement>(null);

    // Detect initial language from path
    useEffect(() => {
        const isZh = markdownPath.includes('-zh.md');
        setLanguage(isZh ? 'zh' : 'en');
        setCurrentPath(markdownPath);
    }, [markdownPath]);

    useEffect(() => {
        const loadMarkdown = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const response = await fetch(currentPath);
                if (!response.ok) {
                    throw new Error(`Failed to load document: ${response.statusText}`);
                }
                
                const text = await response.text();
                
                // Configure marked to generate IDs for headings
                marked.use(gfmHeadingId());
                
                const html = marked.parse(text);
                setContent(html as string);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load document');
            } finally {
                setLoading(false);
            }
        };

        loadMarkdown();
    }, [currentPath]);

    const toggleLanguage = () => {
        const newLang = language === 'en' ? 'zh' : 'en';
        setLanguage(newLang);
        
        // Toggle between English and Chinese versions
        if (newLang === 'zh') {
            setCurrentPath(currentPath.replace('.md', '-zh.md'));
        } else {
            setCurrentPath(currentPath.replace('-zh.md', '.md'));
        }
    };

    // Handle ESC key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Handle anchor link clicks for smooth scrolling
    useEffect(() => {
        if (!content || !contentRef.current) return;

        const handleAnchorClick = (e: Event) => {
            const target = e.target as HTMLElement;
            
            // Check if clicked element is a link
            if (target.tagName === 'A') {
                const href = target.getAttribute('href');
                
                // Handle internal anchor links (starting with #)
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Get the target element - search within the modal container
                    const targetId = href.substring(1);
                    const targetElement = contentRef.current?.querySelector(`#${CSS.escape(targetId)}`);
                    
                    if (targetElement) {
                        // Smooth scroll to the target within the scrollable container
                        targetElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    } else {
                        console.log('Target element not found:', targetId);
                    }
                }
            }
        };

        const contentDiv = contentRef.current;
        if (contentDiv) {
            contentDiv.addEventListener('click', handleAnchorClick as EventListener);
            return () => contentDiv.removeEventListener('click', handleAnchorClick as EventListener);
        }
    }, [content]);

    return (
        <div className="markdown-viewer-overlay" onClick={onClose}>
            <div className="markdown-viewer-container" onClick={(e) => e.stopPropagation()}>
                <div className="markdown-viewer-header">
                    <h2>{title}</h2>
                    <div className="markdown-viewer-controls">
                        <button 
                            className="markdown-viewer-lang-toggle"
                            onClick={toggleLanguage}
                            aria-label={`Switch to ${language === 'en' ? 'Chinese' : 'English'}`}
                            title={`Switch to ${language === 'en' ? 'Chinese' : 'English'}`}
                        >
                            {language === 'en' ? '中文' : 'EN'}
                        </button>
                        <button 
                            className="markdown-viewer-close"
                            onClick={onClose}
                            aria-label="Close documentation"
                        >
                            ×
                        </button>
                    </div>
                </div>
                
                <div className="markdown-viewer-content">
                    {loading && (
                        <div className="markdown-viewer-loading">
                            <div className="spinner"></div>
                            <p>Loading documentation...</p>
                        </div>
                    )}
                    
                    {error && (
                        <div className="markdown-viewer-error">
                            <p>Error: {error}</p>
                        </div>
                    )}
                    
                    {!loading && !error && (
                        <div 
                            ref={contentRef}
                            className="markdown-body"
                            dangerouslySetInnerHTML={{ __html: content }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MarkdownViewer;
