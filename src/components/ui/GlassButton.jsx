import React from 'react';

const GlassButton = ({
    children,
    className = '',
    variant = 'primary',
    ...rest
}) => {
    const variantClass = variant === 'secondary' ? 'glass-button-secondary' : '';
    return (
        <button className={`glass-button ${variantClass} ${className}`.trim()} {...rest}>
            {children}
        </button>
    );
};

export default GlassButton;

