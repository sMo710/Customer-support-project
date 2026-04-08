import React from 'react';

const GlassCard = ({ children, className = '', style = {}, ...rest }) => {
    return (
        <div className={`glass-card ${className}`.trim()} style={style} {...rest}>
            {children}
        </div>
    );
};

export default GlassCard;

